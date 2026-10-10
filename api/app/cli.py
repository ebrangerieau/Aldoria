"""Administration en ligne de commande (avant l'éditeur parent de la phase 2).

python -m app.cli list
python -m app.cli create --name Jules --level 6e --world jules --avatar renard --pin 1234
python -m app.cli set-pin --name Jules --pin 5678
python -m app.cli unlock --name Jules
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select

from app.auth import hash_pin
from app.db import get_sessionmaker
from app.models import Profile

LEVELS = {"6e": "jules", "2nde": "tom"}


async def _run(args: argparse.Namespace) -> None:
    async with get_sessionmaker()() as db:
        if args.command == "list":
            for p in await db.scalars(select(Profile).order_by(Profile.id)):
                state = "PIN défini" if p.pin_hash else "sans PIN"
                print(f"{p.id}\t{p.name}\t{p.level}\t{p.world}\t{p.avatar}\t{state}")
            return
        if args.command == "create":
            profile = Profile(
                name=args.name,
                avatar=args.avatar,
                level=args.level,
                world=args.world or LEVELS[args.level],
                pin_hash=hash_pin(args.pin),
            )
            db.add(profile)
            await db.commit()
            print(f"Profil créé : {profile.id} {profile.name}")
            return
        profile = await db.scalar(select(Profile).where(Profile.name == args.name))
        if profile is None:
            raise SystemExit(f"Profil introuvable : {args.name}")
        if args.command == "set-pin":
            profile.pin_hash = hash_pin(args.pin)
        profile.failed_logins = 0
        profile.locked_until = None
        await db.commit()
        print(f"Profil mis à jour : {profile.name}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list")
    create = sub.add_parser("create")
    create.add_argument("--name", required=True)
    create.add_argument("--level", required=True, choices=sorted(LEVELS))
    create.add_argument("--world", choices=sorted(set(LEVELS.values())))
    create.add_argument("--avatar", required=True)
    create.add_argument("--pin", required=True)
    set_pin = sub.add_parser("set-pin")
    set_pin.add_argument("--name", required=True)
    set_pin.add_argument("--pin", required=True)
    unlock = sub.add_parser("unlock")
    unlock.add_argument("--name", required=True)
    asyncio.run(_run(parser.parse_args()))


if __name__ == "__main__":
    main()
