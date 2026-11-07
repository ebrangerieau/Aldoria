"""État des sauvegardes affiché dans l'espace parent (fichiers écrits par le service
« backup » et par la copie à la maison, voir deploy/backup/)."""

import json
from datetime import UTC, datetime

import pytest

from app import backups
from app.config import get_settings
from app.models import Adult
from tests.test_admin import parent

ADMIN = "/api/v1/admin"
KEY = "k" * 40
NOW = datetime(2026, 10, 12, 18, 0, tzinfo=UTC)


def write(folder, name: str, data) -> None:
    (folder / name).write_text(
        data if isinstance(data, str) else json.dumps(data), encoding="utf-8"
    )


def success(date: str = "2026-10-12T03:00:04Z", error=None) -> dict:
    return {
        "essai": "2026-10-12T03:00:04Z",
        "derniere_reussite": {
            "fichier": "aldoria-20261012T030002Z.sql.gz",
            "octets": 13155,
            "date": date,
        },
        "copies": 9,
        "erreur": error,
    }


def test_not_configured():
    assert backups.status("") == {"configured": False}


def test_nothing_yet(tmp_path):
    result = backups.status(str(tmp_path), NOW)
    assert result["state"] == "none"
    assert result["last"] is None
    assert result["home_state"] == "none"


def test_recent_backup_is_ok(tmp_path):
    write(tmp_path, "sauvegarde.json", success())
    result = backups.status(str(tmp_path), NOW)
    assert result["state"] == "ok"
    assert result["last"] == {
        "file": "aldoria-20261012T030002Z.sql.gz",
        "bytes": 13155,
        "date": "2026-10-12T03:00:04Z",
    }
    assert result["copies"] == 9
    assert result["error"] is None


def test_old_backup_is_late(tmp_path):
    write(tmp_path, "sauvegarde.json", success(date="2026-10-10T03:00:04Z"))
    assert backups.status(str(tmp_path), NOW)["state"] == "late"


def test_failed_attempt_wins_over_older_success(tmp_path):
    write(tmp_path, "sauvegarde.json", success(error="connection refused"))
    result = backups.status(str(tmp_path), NOW)
    assert result["state"] == "failed"
    assert result["error"] == "connection refused"
    assert result["last"]["file"] == "aldoria-20261012T030002Z.sql.gz"


def test_failure_without_any_backup(tmp_path):
    write(
        tmp_path,
        "sauvegarde.json",
        {"essai": "2026-10-12T03:00:04Z", "derniere_reussite": None, "copies": 0, "erreur": "x"},
    )
    assert backups.status(str(tmp_path), NOW)["state"] == "failed"


def test_unreadable_state_is_none(tmp_path):
    write(tmp_path, "sauvegarde.json", "{pas du json")
    write(tmp_path, "copie.json", "[1, 2]")
    result = backups.status(str(tmp_path), NOW)
    assert result["state"] == "none"
    assert result["home_state"] == "none"


@pytest.mark.parametrize(
    ("date", "state"), [("2026-10-11T19:00:00Z", "ok"), ("2026-10-01T19:00:00Z", "late")]
)
def test_home_copy(tmp_path, date, state):
    write(tmp_path, "copie.json", {"date": date, "fichier": "aldoria-20261011T030002Z.sql.gz"})
    result = backups.status(str(tmp_path), NOW)
    assert result["home_state"] == state
    assert result["home"] == {"file": "aldoria-20261011T030002Z.sql.gz", "date": date}


async def test_route_is_for_the_operator_only(client, sessionmaker, tmp_path, monkeypatch):
    write(tmp_path, "sauvegarde.json", success())
    monkeypatch.setenv("ALDORIA_ADMIN_KEY", KEY)
    monkeypatch.setenv("ALDORIA_BACKUP_STATUS_DIR", str(tmp_path))
    get_settings.cache_clear()
    try:
        assert (await client.get(f"{ADMIN}/backups")).status_code == 404
        response = await client.get(f"{ADMIN}/backups", headers=parent())
        assert response.status_code == 403, "un parent ordinaire ne voit pas l'exploitation"
        async with sessionmaker() as db:
            (await db.get(Adult, 1)).is_operator = True
            await db.commit()
        response = await client.get(f"{ADMIN}/backups", headers=parent())
        assert response.status_code == 200
        assert response.json()["last"]["bytes"] == 13155
    finally:
        get_settings.cache_clear()
