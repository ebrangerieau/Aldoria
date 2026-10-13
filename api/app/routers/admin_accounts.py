"""Espace parent : connexion des adultes, invitations, famille (adultes, enfants,
appareils) et, pour l'exploitant, les familles du serveur. Voir accounts.py pour les
sessions et IMPLEMENTATION_PLAN (chantier « plusieurs familles »)."""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import accounts, erasure
from app.accounts import AdminHost, CurrentAdult, CurrentOperator, aware, utcnow
from app.auth import hash_pin, verify_pin
from app.config import get_settings
from app.db import get_db
from app.engine import ai_author, levels
from app.engine.levels import LevelCode, WorldCode
from app.errors import ApiError
from app.models import (
    Adult,
    AdultSession,
    AiUsage,
    Attempt,
    Device,
    Family,
    Invitation,
    Profile,
)
from app.routers.admin import _profile, _profile_out

router = APIRouter(prefix="/admin", tags=["admin"])
Db = Annotated[AsyncSession, Depends(get_db)]

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
BAD_CREDENTIALS = "E-mail ou mot de passe incorrect."
INVALID_LINK = "Ce lien n'est plus valable : demandez-en un nouveau à un adulte de la famille."


# --- Schémas ------------------------------------------------------------------------


class LoginIn(BaseModel):
    email: str = Field(max_length=200)
    password: str = Field(max_length=200)


class AcceptIn(BaseModel):
    password: str = Field(max_length=200)
    name: str = Field(default="", max_length=60)
    email: str = Field(default="", max_length=200)
    family_name: str = Field(default="", max_length=80)


class PasswordIn(BaseModel):
    current: str = Field(max_length=200)
    new: str = Field(max_length=200)


class NoteIn(BaseModel):
    note: str = Field(default="", max_length=80)


class NameIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ConfirmIn(BaseModel):
    confirm: str = Field(max_length=80)


class ChildIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    level: LevelCode
    world: WorldCode | None = None  # par défaut selon le cycle (levels.default_world)
    pin: str = Field(pattern=r"^[0-9]{4}$")


class DeviceCodeIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)


# --- Connexion -------------------------------------------------------------------------


@router.post("/login")
async def login(
    body: LoginIn, request: Request, response: Response, _host: AdminHost, db: Db
) -> dict[str, Any]:
    """Même réponse pour un e-mail inconnu et un mauvais mot de passe ; blocage de
    15 minutes après 5 erreurs (Traefik limite en plus le débit de cette route)."""
    adult = await db.scalar(select(Adult).where(Adult.email == body.email.strip().lower()))
    if adult is None:
        accounts.burn_time(body.password)
        raise ApiError(401, "bad_credentials", BAD_CREDENTIALS)
    now = utcnow()
    locked_until = aware(adult.locked_until)
    if locked_until and locked_until > now:
        raise ApiError(
            423,
            "locked",
            "Trop d'essais : réessayez dans quelques minutes.",
            retry_after_s=int((locked_until - now).total_seconds()) + 1,
        )
    if not accounts.verify_password(adult.password_hash, body.password):
        adult.failed_logins += 1
        if adult.failed_logins >= accounts.MAX_FAILED:
            adult.failed_logins = 0
            adult.locked_until = now + timedelta(minutes=accounts.LOCK_MINUTES)
        await db.commit()
        raise ApiError(401, "bad_credentials", BAD_CREDENTIALS)
    adult.failed_logins = 0
    adult.locked_until = None
    await accounts.open_session(db, adult, response, request.headers.get("user-agent", ""))
    return await _me(db, adult)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, adult: CurrentAdult, db: Db) -> None:
    await db.execute(delete(AdultSession).where(AdultSession.id == request.state.session_id))
    await db.commit()
    accounts.close_cookie(response)


@router.get("/me")
async def me(adult: CurrentAdult, db: Db) -> dict[str, Any]:
    return await _me(db, adult)


@router.put("/me/password", status_code=204)
async def change_password(body: PasswordIn, request: Request, adult: CurrentAdult, db: Db) -> None:
    """Nouveau mot de passe ; les autres sessions (autres appareils) sont fermées."""
    if not accounts.verify_password(adult.password_hash, body.current):
        raise ApiError(422, "bad_password", "Mot de passe actuel incorrect.")
    adult.password_hash = accounts.hash_password(body.new)
    await _close_other_sessions(db, adult, request.state.session_id)
    await db.commit()


@router.post("/me/logout-others")
async def logout_others(request: Request, adult: CurrentAdult, db: Db) -> dict[str, int]:
    closed = await _close_other_sessions(db, adult, request.state.session_id)
    await db.commit()
    return {"closed": closed}


# --- Invitations (lien reçu, sans être connecté) -----------------------------------------


@router.get("/invitations/{token}")
async def read_invitation(token: str, _host: AdminHost, db: Db) -> dict[str, Any]:
    invitation = await _valid_invitation(db, token)
    family = await db.get(Family, invitation.family_id) if invitation.family_id else None
    adult = await db.get(Adult, invitation.adult_id) if invitation.adult_id else None
    return {
        "kind": invitation.kind,
        "family": family.name if family else None,
        "adult": {"name": adult.name, "email": adult.email} if adult else None,
        "expires_at": aware(invitation.expires_at).isoformat(),
    }


@router.post("/invitations/{token}/accept")
async def accept_invitation(
    token: str, body: AcceptIn, request: Request, response: Response, _host: AdminHost, db: Db
) -> dict[str, Any]:
    """Rejoindre une famille, en créer une, ou choisir un nouveau mot de passe ; puis
    connexion. Le lien ne sert qu'une fois."""
    invitation = await _valid_invitation(db, token)
    password_hash = accounts.hash_password(body.password)
    if invitation.kind == "mot_de_passe":
        adult = await db.get(Adult, invitation.adult_id)
        if adult is None:
            raise ApiError(404, "invitation_invalid", INVALID_LINK)
        adult.password_hash = password_hash
        adult.failed_logins = 0
        adult.locked_until = None
        await db.execute(delete(AdultSession).where(AdultSession.adult_id == adult.id))
    else:
        name = body.name.strip()
        email = body.email.strip().lower()
        if not name:
            raise ApiError(422, "missing_name", "Indiquez votre prénom.")
        if not EMAIL.match(email):
            raise ApiError(422, "bad_email", "Adresse e-mail invalide.")
        if await db.scalar(select(Adult.id).where(Adult.email == email)):
            raise ApiError(409, "email_taken", "Un compte existe déjà avec cet e-mail.")
        family_id = invitation.family_id
        if invitation.kind == "famille":
            family_name = body.family_name.strip()
            if not family_name:
                raise ApiError(422, "missing_family", "Donnez un nom à votre famille.")
            family = Family(name=family_name)
            db.add(family)
            await db.flush()
            family_id = family.id
        adult = Adult(
            family_id=family_id,
            email=email,
            name=name,
            password_hash=password_hash,
            is_operator=invitation.operator,
        )
        db.add(adult)
        await db.flush()
    invitation.used_at = utcnow()
    await accounts.open_session(db, adult, response, request.headers.get("user-agent", ""))
    return await _me(db, adult)


# --- Famille : adultes -------------------------------------------------------------------


@router.get("/adults")
async def list_adults(request: Request, adult: CurrentAdult, db: Db) -> dict[str, Any]:
    adults = await db.scalars(
        select(Adult).where(Adult.family_id == adult.family_id).order_by(Adult.id)
    )
    pending = await db.scalars(
        select(Invitation)
        .where(
            Invitation.family_id == adult.family_id,
            Invitation.kind == "adulte",
            Invitation.used_at.is_(None),
            Invitation.expires_at > utcnow(),
        )
        .order_by(Invitation.created_at)
    )
    return {
        "adults": [
            {
                "id": a.id,
                "name": a.name,
                "email": a.email,
                "is_me": a.id == adult.id,
                "is_operator": a.is_operator,
                "last_login_at": _iso(a.last_login_at),
            }
            for a in adults
        ],
        "invitations": [
            {"id": i.id, "note": i.note, "expires_at": _iso(i.expires_at)} for i in pending
        ],
    }


@router.post("/adults/invitations", status_code=201)
async def invite_adult(body: NoteIn, adult: CurrentAdult, db: Db) -> dict[str, Any]:
    token, invitation = await accounts.create_invitation(
        db, "adulte", family_id=adult.family_id, created_by=adult.id, note=body.note.strip()
    )
    return {"link": accounts.invitation_link(token), "expires_at": _iso(invitation.expires_at)}


@router.delete("/adults/invitations/{invitation_id}", status_code=204)
async def cancel_invitation(invitation_id: str, adult: CurrentAdult, db: Db) -> None:
    invitation = await db.get(Invitation, invitation_id)
    if invitation is None or invitation.family_id != adult.family_id:
        raise ApiError(404, "unknown_invitation", "Invitation introuvable.")
    await db.delete(invitation)
    await db.commit()


@router.post("/adults/{adult_id}/password-link", status_code=201)
async def password_link(adult_id: int, adult: CurrentAdult, db: Db) -> dict[str, Any]:
    """Mot de passe oublié par un autre adulte de la famille : lien à lui transmettre."""
    target = await _family_adult(db, adult_id, adult)
    token, invitation = await accounts.create_invitation(
        db, "mot_de_passe", adult_id=target.id, created_by=adult.id
    )
    return {"link": accounts.invitation_link(token), "expires_at": _iso(invitation.expires_at)}


@router.delete("/adults/{adult_id}", status_code=204)
async def remove_adult(adult_id: int, adult: CurrentAdult, db: Db) -> None:
    target = await _family_adult(db, adult_id, adult)
    if target.is_operator:
        raise ApiError(422, "operator", "L'exploitant du serveur ne peut pas être retiré ici.")
    count = await db.scalar(select(func.count()).where(Adult.family_id == adult.family_id))
    if count <= 1:
        raise ApiError(422, "last_adult", "Il faut au moins un adulte dans la famille.")
    await db.execute(delete(AdultSession).where(AdultSession.adult_id == target.id))
    await db.execute(delete(Invitation).where(Invitation.adult_id == target.id))
    await db.delete(target)
    await db.commit()


# --- Famille : nom, enfants, appareils, suppression ---------------------------------------


@router.put("/family")
async def rename_family(body: NameIn, adult: CurrentAdult, db: Db) -> dict[str, Any]:
    family = await db.get(Family, adult.family_id)
    family.name = body.name.strip()
    await db.commit()
    return await _me(db, adult)


@router.post("/family/delete", status_code=204)
async def delete_family(body: ConfirmIn, response: Response, adult: CurrentAdult, db: Db) -> None:
    """Efface la famille et tout ce qui lui appartient (droit à l'effacement)."""
    family = await db.get(Family, adult.family_id)
    if body.confirm.strip().lower() != family.name.lower():
        raise ApiError(422, "confirmation", f"Écrivez « {family.name} » pour confirmer.")
    if adult.is_operator:
        raise ApiError(
            422, "operator", "La famille de l'exploitant ne peut pas être supprimée ici."
        )
    await erasure.delete_family(db, family.id)
    await db.commit()
    accounts.close_cookie(response)


@router.post("/profiles", status_code=201)
async def create_child(body: ChildIn, adult: CurrentAdult, db: Db) -> dict[str, Any]:
    name = body.name.strip()
    siblings = list(await db.scalars(select(Profile).where(Profile.family_id == adult.family_id)))
    if not name:
        raise ApiError(422, "missing_name", "Indiquez le prénom de l'enfant.")
    if body.level not in await levels.available(db):
        raise ApiError(
            422, "level_unavailable", f"La {levels.label(body.level)} n'est pas encore dans le jeu."
        )
    if any(p.name.lower() == name.lower() for p in siblings):
        raise ApiError(409, "name_taken", f"{name} existe déjà dans la famille.")
    for other in siblings:
        if verify_pin(other.pin_hash, body.pin):
            raise ApiError(
                422,
                "pin_taken",
                f"Ce code est déjà celui de {other.name} : choisissez-en un autre.",
            )
    world = body.world or levels.default_world(body.level)
    profile = Profile(
        family_id=adult.family_id,
        name=name,
        level=body.level,
        world=world,
        avatar=levels.AVATARS[world],
        pin_hash=hash_pin(body.pin),
    )
    db.add(profile)
    await db.commit()
    return _profile_out(profile)


@router.post("/profiles/{profile_id}/delete", status_code=204)
async def delete_child(profile_id: int, body: ConfirmIn, adult: CurrentAdult, db: Db) -> None:
    profile = await _profile(db, profile_id, adult)
    if body.confirm.strip().lower() != profile.name.lower():
        raise ApiError(422, "confirmation", f"Écrivez « {profile.name} » pour confirmer.")
    await erasure.delete_profile(db, profile)
    await db.commit()


@router.get("/devices")
async def list_devices(adult: CurrentAdult, db: Db) -> list[dict[str, Any]]:
    rows = await db.scalars(
        select(Device).where(Device.family_id == adult.family_id).order_by(Device.id)
    )
    return [
        {
            "id": d.id,
            "name": d.name,
            "created_at": _iso(d.created_at),
            "last_seen_at": _iso(d.last_seen_at),
        }
        for d in rows
    ]


@router.post("/devices/code", status_code=201)
async def device_code(body: DeviceCodeIn, adult: CurrentAdult, db: Db) -> dict[str, Any]:
    code, pairing = await accounts.create_pairing_code(db, adult.family_id, body.name.strip())
    return {"code": code, "expires_at": _iso(pairing.expires_at)}


@router.delete("/devices/{device_id}", status_code=204)
async def remove_device(device_id: int, adult: CurrentAdult, db: Db) -> None:
    """L'appareil ne voit plus les enfants ; ses parties en cours sont fermées."""
    device = await db.get(Device, device_id)
    if device is None or device.family_id != adult.family_id:
        raise ApiError(404, "unknown_device", "Appareil introuvable.")
    await db.delete(device)
    await db.commit()


# --- Exploitant ----------------------------------------------------------------------------


@router.get("/families")
async def list_families(operator: CurrentOperator, db: Db) -> list[dict[str, Any]]:
    model = get_settings().ai_model
    result = []
    for family in await db.scalars(select(Family).order_by(Family.id)):
        profile_ids = select(Profile.id).where(Profile.family_id == family.id)
        last = await db.scalar(
            select(func.max(Attempt.answered_at)).where(Attempt.profile_id.in_(profile_ids))
        )
        month = await db.execute(
            select(
                func.coalesce(func.sum(AiUsage.requests), 0),
                func.coalesce(func.sum(AiUsage.input_tokens), 0),
                func.coalesce(func.sum(AiUsage.output_tokens), 0),
            ).where(AiUsage.family_id == family.id, AiUsage.day >= utcnow().date().replace(day=1))
        )
        requests, tokens_in, tokens_out = month.one()
        cost = ai_author.cost_usd(int(tokens_in), int(tokens_out), model)
        result.append(
            {
                "id": family.id,
                "name": family.name,
                "ai_requests_month": int(requests),
                "ai_cost_month_usd": round(cost, 2),
                "created_at": _iso(family.created_at),
                "adults": await _count(db, Adult, family.id),
                "children": await _count(db, Profile, family.id),
                "devices": await _count(db, Device, family.id),
                "last_activity": _iso(last),
            }
        )
    return result


@router.post("/families/invitations", status_code=201)
async def invite_family(body: NoteIn, operator: CurrentOperator, db: Db) -> dict[str, Any]:
    token, invitation = await accounts.create_invitation(
        db, "famille", created_by=operator.id, note=body.note.strip()
    )
    return {"link": accounts.invitation_link(token), "expires_at": _iso(invitation.expires_at)}


# --- Aides ----------------------------------------------------------------------------------


async def _me(db: AsyncSession, adult: Adult) -> dict[str, Any]:
    family = await db.get(Family, adult.family_id)
    return {
        "adult": {
            "id": adult.id,
            "name": adult.name,
            "email": adult.email,
            "is_operator": adult.is_operator,
        },
        "family": {"id": family.id, "name": family.name},
    }


async def _valid_invitation(db: AsyncSession, token: str) -> Invitation:
    invitation = await db.get(Invitation, accounts.digest(token)) if token else None
    if (
        invitation is None
        or invitation.used_at is not None
        or aware(invitation.expires_at) <= utcnow()
    ):
        raise ApiError(404, "invitation_invalid", INVALID_LINK)
    return invitation


async def _family_adult(db: AsyncSession, adult_id: int, adult: Adult) -> Adult:
    target = await db.get(Adult, adult_id)
    if target is None or target.family_id != adult.family_id:
        raise ApiError(404, "unknown_adult", "Adulte introuvable.")
    return target


async def _close_other_sessions(db: AsyncSession, adult: Adult, current: str) -> int:
    result = await db.execute(
        delete(AdultSession).where(AdultSession.adult_id == adult.id, AdultSession.id != current)
    )
    return result.rowcount or 0


async def _count(db: AsyncSession, model: Any, family_id: int) -> int:
    return int(await db.scalar(select(func.count()).where(model.family_id == family_id)) or 0)


def _iso(value: datetime | None) -> str | None:
    value = aware(value)
    return value.astimezone(UTC).isoformat() if value else None
