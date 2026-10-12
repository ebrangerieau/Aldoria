"""Espace parent, contenu (PRD US-10) : banque de questions rédigées (création,
aperçu, import CSV/JSON avec rapport ligne par ligne, publication), aperçu des
générateurs, signalements d'erreur envoyés par les enfants.

Mêmes protections que le reste de l'espace parent (`CurrentParent`, voir admin.py) : la
banque et les signalements sont ceux de la famille de l'adulte connecté.
"""

from __future__ import annotations

import random
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.engine import bank, session_pack
from app.engine.generators import REGISTRY, for_level
from app.engine.items import Item
from app.errors import ApiError
from app.models import Adult, BankItem, Chapter, Notion, Profile, Report
from app.routers.admin import CurrentParent, Db

router = APIRouter(prefix="/admin", tags=["admin"])

Level = Literal["6e", "2nde"]


class BankItemIn(BaseModel):
    level: Level
    status: Literal["brouillon", "publie"] = "brouillon"
    question: dict[str, Any]


class BankPreviewIn(BaseModel):
    level: Level
    question: dict[str, Any]


class ImportIn(BaseModel):
    level: Level
    format: Literal["csv", "json"]
    content: str = Field(max_length=bank.MAX_IMPORT_BYTES)
    # Faux : rapport seulement (rien n'est enregistré) ; vrai : les lignes valides
    # sont ajoutées en brouillon.
    commit: bool = False


class ReportStatusIn(BaseModel):
    status: Literal["ouvert", "traite"]


# --- Banque --------------------------------------------------------------------------


async def _notions(db: Db) -> dict[str, tuple[str, bool]]:
    rows = await db.execute(select(Notion.code, Chapter.level, Notion.is_automatism).join(Chapter))
    return {code: (level, auto) for code, level, auto in rows.all()}


def _bank_out(row: BankItem, full: bool = False) -> dict[str, Any]:
    out = {
        "id": row.id,
        "level": row.level,
        "notion": row.notion,
        "type": row.data.get("type"),
        "difficulty": row.difficulty,
        "status": row.status,
        "source": row.source,
        "summary": bank.summary(row.data),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
    if full:
        out["question"] = row.data | {"notion": row.notion}
    return out


def _preview(data: dict[str, Any]) -> dict[str, Any]:
    """Question telle que le jeu la reçoit, avec la formule rendue en SVG."""
    formulas: dict[str, str] = {}
    item = session_pack.item_data(Item(id="apercu", **data), "chapitre", formulas)
    return {"item": item, "formulas": formulas}


async def _checked(db: Db, level: str, question: dict[str, Any]) -> dict[str, Any]:
    checked = bank.validate(question, await _notions(db), level)
    if checked.errors:
        raise ApiError(422, "invalid_question", "Question à corriger.", errors=checked.errors)
    return checked.data


@router.get("/bank")
async def list_bank(parent: CurrentParent, db: Db, level: Level | None = None) -> list[dict]:
    query = (
        select(BankItem)
        .where(BankItem.family_id == parent.family_id)
        .order_by(BankItem.notion, BankItem.difficulty, BankItem.id)
    )
    if level:
        query = query.where(BankItem.level == level)
    return [_bank_out(row) for row in await db.scalars(query)]


@router.get("/bank/{item_id}")
async def get_bank_item(item_id: int, parent: CurrentParent, db: Db) -> dict[str, Any]:
    return _bank_out(await _bank_row(db, item_id, parent), full=True)


@router.post("/bank", status_code=201)
async def create_bank_item(body: BankItemIn, parent: CurrentParent, db: Db) -> dict[str, Any]:
    data = await _checked(db, body.level, body.question)
    row = BankItem(
        family_id=parent.family_id,
        level=body.level,
        notion=data["notions"][0],
        difficulty=data["difficulty"],
        status=body.status,
        source="parent",
        data=data,
    )
    db.add(row)
    await db.commit()
    return _bank_out(row, full=True)


@router.put("/bank/{item_id}")
async def update_bank_item(
    item_id: int, body: BankItemIn, parent: CurrentParent, db: Db
) -> dict[str, Any]:
    row = await _bank_row(db, item_id, parent)
    data = await _checked(db, body.level, body.question)
    if data != row.data:
        row.version += 1  # nouvel identifiant de jeu : le suivi repart sur la question corrigée
    row.level, row.notion, row.difficulty = body.level, data["notions"][0], data["difficulty"]
    row.data, row.status, row.updated_at = data, body.status, datetime.now(UTC)
    await db.commit()
    return _bank_out(row, full=True)


@router.delete("/bank/{item_id}", status_code=204)
async def delete_bank_item(item_id: int, parent: CurrentParent, db: Db) -> None:
    await db.delete(await _bank_row(db, item_id, parent))
    await db.commit()


@router.post("/bank/preview")
async def preview_bank_item(body: BankPreviewIn, parent: CurrentParent, db: Db) -> dict:
    checked = bank.validate(body.question, await _notions(db), body.level)
    if checked.errors:
        return {"ok": False, "errors": checked.errors}
    return {"ok": True, "errors": [], **_preview(checked.data)}


@router.post("/bank/import")
async def import_bank(body: ImportIn, parent: CurrentParent, db: Db) -> dict[str, Any]:
    rows, error = bank.parse_import(body.content, body.format)
    if error:
        raise ApiError(422, "unreadable_file", error)
    notions = await _notions(db)
    report, valid = [], []
    for line, raw in rows:
        if isinstance(raw, str):
            report.append({"line": line, "ok": False, "errors": [raw], "summary": ""})
            continue
        checked = bank.validate(raw, notions, body.level)
        report.append(
            {
                "line": line,
                "ok": not checked.errors,
                "errors": checked.errors,
                "summary": bank.summary(checked.data or raw),
            }
        )
        if checked.data:
            valid.append(checked.data)
    if body.commit:
        for data in valid:
            db.add(
                BankItem(
                    family_id=parent.family_id,
                    level=body.level,
                    notion=data["notions"][0],
                    difficulty=data["difficulty"],
                    status="brouillon",
                    source="import",
                    data=data,
                )
            )
        await db.commit()
    return {
        "lines": report,
        "valid": len(valid),
        "invalid": len(report) - len(valid),
        "created": len(valid) if body.commit else 0,
    }


async def _bank_row(db: Db, item_id: int, parent: Adult) -> BankItem:
    row = await db.get(BankItem, item_id)
    if row is None or row.family_id != parent.family_id:
        raise ApiError(404, "unknown_item", "Question introuvable.")
    return row


# --- Générateurs ------------------------------------------------------------------------

PREVIEW_COUNT = 10


@router.get("/generators")
async def list_generators(parent: CurrentParent, db: Db, level: Level) -> list[dict[str, Any]]:
    labels = dict((await db.execute(select(Notion.code, Notion.label))).all())
    return [
        {
            "code": g.code,
            "title": g.title,
            "notion": g.notion,
            "notion_label": labels.get(g.notion, g.notion),
            "role": g.role,
            "use": "combat" if g.combat else "énigme ou quête",
        }
        for g in sorted(for_level(level), key=lambda g: g.notion)
    ]


@router.get("/generators/{code}/preview")
async def preview_generator(
    code: str, parent: CurrentParent, difficulty: int = 3, seed: int | None = None
) -> dict[str, Any]:
    generator = REGISTRY.get(code)
    if generator is None:
        raise ApiError(404, "unknown_generator", "Générateur inconnu.")
    if not 1 <= difficulty <= 5:
        raise ApiError(422, "bad_difficulty", "Difficulté de 1 à 5.")
    rng = random.Random(seed)
    formulas: dict[str, str] = {}
    items = [
        session_pack.item_data(
            generator.item(difficulty, rng.randrange(1_000_000_000)), "chapitre", formulas
        )
        for _ in range(PREVIEW_COUNT)
    ]
    return {"items": items, "formulas": formulas}


# --- Signalements ---------------------------------------------------------------------------


@router.get("/reports")
async def list_reports(parent: CurrentParent, db: Db, status: str = "ouvert") -> list[dict]:
    rows = await db.execute(
        select(Report, Profile.name)
        .join(Profile, Report.profile_id == Profile.id)
        .where(Report.status == status, Profile.family_id == parent.family_id)
        .order_by(Report.created_at.desc())
        .limit(200)
    )
    result = []
    for report, name in rows.all():
        bank_id = None
        if report.item_id.startswith("banque:"):
            bank_id = int(report.item_id.split(":")[1])
        result.append(
            {
                "id": report.id,
                "child": name,
                "item_id": report.item_id,
                "bank_id": bank_id,
                "item": report.item,
                "user_input": report.user_input,
                "reason": report.reason,
                "status": report.status,
                "created_at": report.created_at.isoformat(),
            }
        )
    return result


@router.get("/reports/count")
async def count_reports(parent: CurrentParent, db: Db) -> dict[str, int]:
    open_reports = await db.scalar(
        select(func.count())
        .select_from(Report)
        .join(Profile, Report.profile_id == Profile.id)
        .where(Report.status == "ouvert", Profile.family_id == parent.family_id)
    )
    return {"open": int(open_reports or 0)}


@router.put("/reports/{report_id}")
async def set_report_status(
    report_id: int, body: ReportStatusIn, parent: CurrentParent, db: Db
) -> dict[str, Any]:
    report = await db.get(Report, report_id)
    child = await db.get(Profile, report.profile_id) if report else None
    if report is None or child is None or child.family_id != parent.family_id:
        raise ApiError(404, "unknown_report", "Signalement introuvable.")
    report.status = body.status
    await db.commit()
    return {"id": report.id, "status": report.status}
