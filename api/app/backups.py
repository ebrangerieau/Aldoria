"""État des sauvegardes de la base, pour l'espace parent.

Le service « backup » (deploy/backup/sauvegarde.sh) écrit `sauvegarde.json` après chaque
essai ; la copie à la maison (deploy/backup/copie-maison.sh) écrit `copie.json` quand une
sauvegarde a été reçue intacte. L'API ne voit que ce dossier d'état, jamais les sauvegardes.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

# Une sauvegarde par jour : en retard au-delà d'un jour et demi.
LATE_AFTER = timedelta(hours=36)
# Copie à la maison : l'ordinateur familial n'est pas toujours allumé.
HOME_LATE_AFTER = timedelta(days=8)


def _read(path: Path) -> dict[str, Any] | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _date(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def status(directory: str, now: datetime | None = None) -> dict[str, Any]:
    if not directory:
        return {"configured": False}
    now = now or datetime.now(UTC)
    folder = Path(directory)
    backup = _read(folder / "sauvegarde.json") or {}
    last = (
        backup.get("derniere_reussite")
        if isinstance(backup.get("derniere_reussite"), dict)
        else None
    )
    last_date = _date(last.get("date")) if last else None
    error = backup.get("erreur") if isinstance(backup.get("erreur"), str) else None
    if last_date is None:
        state = "failed" if error else "none"
    elif error:
        state = "failed"
    elif now - last_date > LATE_AFTER:
        state = "late"
    else:
        state = "ok"

    home = _read(folder / "copie.json")
    home_date = _date(home.get("date")) if home else None
    if home_date is None:
        home_state = "none"
    else:
        home_state = "late" if now - home_date > HOME_LATE_AFTER else "ok"

    return {
        "configured": True,
        "state": state,
        "last": (
            {
                "file": str(last.get("fichier", "")),
                "bytes": int(last.get("octets", 0) or 0),
                "date": _iso(last_date),
            }
            if last and last_date
            else None
        ),
        "copies": int(backup.get("copies", 0) or 0),
        "error": error,
        "attempt": _iso(_date(backup.get("essai"))),
        "home": (
            {"file": str(home.get("fichier", "")), "date": _iso(home_date)}
            if home and home_date
            else None
        ),
        "home_state": home_state,
    }


def _iso(value: datetime | None) -> str | None:
    return value.isoformat().replace("+00:00", "Z") if value else None
