"""Administration en ligne de commande (sur le serveur : `docker compose exec -T api …`).

python -m app.cli seed      (programme : content/seed, idempotent)
python -m app.cli rebuild-tracking   (rejoue toutes les réponses dans le suivi par notion)
python -m app.cli list      (familles, adultes, enfants, appareils)
python -m app.cli create-family --name "Famille Martin"
python -m app.cli invite --family 1 [--operator] [--note "pour Karine"]  (rejoindre la famille)
python -m app.cli invite-family [--operator] [--note …]                  (créer une famille)
python -m app.cli reset-password --email parent@example.org              (nouveau mot de passe)
python -m app.cli create-adult --family 1 --email … --name … --password …  (bancs de test)
python -m app.cli pairing-code --family 1 --name "Tablette"              (relier un appareil)
python -m app.cli create --family 1 --name Jules --level 6e --pin 1234
python -m app.cli set-pin --family 1 --name Jules --pin 5678
python -m app.cli unlock --family 1 --name Jules

Un lien d'invitation ne sert qu'une fois ; il s'affiche ici et n'est gardé nulle part.
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select

from app import accounts
from app.auth import hash_pin
from app.db import get_sessionmaker
from app.engine.tracking import rebuild, seed_curriculum
from app.models import Adult, Device, Family, Profile

LEVELS = {"6e": "jules", "2nde": "tom"}
AVATARS = {"6e": "renard", "2nde": "loup"}


async def _family(db, family_id: int) -> Family:
    family = await db.get(Family, family_id)
    if family is None:
        raise SystemExit(f"Famille introuvable : {family_id}")
    return family


async def _run(args: argparse.Namespace) -> None:
    async with get_sessionmaker()() as db:
        match args.command:
            case "seed":
                counts = await seed_curriculum(db)
                chapters, notions = counts["chapters"], counts["notions"]
                print(f"Programme chargé : {chapters} chapitres, {notions} notions")
            case "rebuild-tracking":
                print(f"Suivi reconstruit à partir de {await rebuild(db)} réponses")
            case "list":
                for f in await db.scalars(select(Family).order_by(Family.id)):
                    print(f"Famille {f.id} : {f.name}")
                    for a in await db.scalars(select(Adult).where(Adult.family_id == f.id)):
                        role = " (exploitant)" if a.is_operator else ""
                        print(f"  adulte {a.id}\t{a.name}\t{a.email}{role}")
                    for p in await db.scalars(select(Profile).where(Profile.family_id == f.id)):
                        state = "PIN défini" if p.pin_hash else "sans PIN"
                        print(f"  enfant {p.id}\t{p.name}\t{p.level}\t{p.world}\t{state}")
                    for d in await db.scalars(select(Device).where(Device.family_id == f.id)):
                        print(f"  appareil {d.id}\t{d.name}")
            case "create-family":
                family = Family(name=args.name)
                db.add(family)
                await db.commit()
                print(f"Famille créée : {family.id} {family.name}")
            case "invite":
                await _family(db, args.family)
                token, inv = await accounts.create_invitation(
                    db, "adulte", family_id=args.family, note=args.note, operator=args.operator
                )
                print(f"Lien (valable jusqu'au {inv.expires_at:%d/%m/%Y}, une seule fois) :")
                print(accounts.invitation_link(token))
            case "invite-family":
                token, inv = await accounts.create_invitation(
                    db, "famille", note=args.note, operator=args.operator
                )
                print(f"Lien de création d'une famille (jusqu'au {inv.expires_at:%d/%m/%Y}) :")
                print(accounts.invitation_link(token))
            case "reset-password":
                adult = await db.scalar(select(Adult).where(Adult.email == args.email.lower()))
                if adult is None:
                    raise SystemExit(f"Aucun adulte avec l'e-mail {args.email}")
                token, inv = await accounts.create_invitation(db, "mot_de_passe", adult_id=adult.id)
                print(f"Lien pour {adult.name} (jusqu'au {inv.expires_at:%d/%m/%Y}) :")
                print(accounts.invitation_link(token))
            case "create-adult":
                await _family(db, args.family)
                adult = Adult(
                    family_id=args.family,
                    email=args.email.lower(),
                    name=args.name,
                    password_hash=accounts.hash_password(args.password),
                    is_operator=args.operator,
                )
                db.add(adult)
                await db.commit()
                print(f"Adulte créé : {adult.id} {adult.email}")
            case "pairing-code":
                await _family(db, args.family)
                code, pairing = await accounts.create_pairing_code(db, args.family, args.name)
                print(code)
            case "create":
                await _family(db, args.family)
                profile = Profile(
                    family_id=args.family,
                    name=args.name,
                    avatar=args.avatar or AVATARS[args.level],
                    level=args.level,
                    world=args.world or LEVELS[args.level],
                    pin_hash=hash_pin(args.pin),
                )
                db.add(profile)
                await db.commit()
                print(f"Profil créé : {profile.id} {profile.name}")
            case "set-pin" | "unlock":
                profile = await db.scalar(
                    select(Profile).where(
                        Profile.family_id == args.family, Profile.name == args.name
                    )
                )
                if profile is None:
                    raise SystemExit(f"Profil introuvable : {args.name} (famille {args.family})")
                if args.command == "set-pin":
                    profile.pin_hash = hash_pin(args.pin)
                profile.failed_logins = 0
                profile.locked_until = None
                await db.commit()
                print(f"Profil mis à jour : {profile.name}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("seed")
    sub.add_parser("rebuild-tracking")
    sub.add_parser("list")
    family = sub.add_parser("create-family")
    family.add_argument("--name", required=True)
    invite = sub.add_parser("invite")
    invite.add_argument("--family", type=int, required=True)
    invite.add_argument("--operator", action="store_true")
    invite.add_argument("--note", default="")
    invite_family = sub.add_parser("invite-family")
    invite_family.add_argument("--operator", action="store_true")
    invite_family.add_argument("--note", default="")
    reset = sub.add_parser("reset-password")
    reset.add_argument("--email", required=True)
    adult = sub.add_parser("create-adult")
    adult.add_argument("--family", type=int, required=True)
    adult.add_argument("--email", required=True)
    adult.add_argument("--name", required=True)
    adult.add_argument("--password", required=True)
    adult.add_argument("--operator", action="store_true")
    pairing = sub.add_parser("pairing-code")
    pairing.add_argument("--family", type=int, required=True)
    pairing.add_argument("--name", required=True)
    create = sub.add_parser("create")
    create.add_argument("--family", type=int, default=1)
    create.add_argument("--name", required=True)
    create.add_argument("--level", required=True, choices=sorted(LEVELS))
    create.add_argument("--world", choices=sorted(set(LEVELS.values())))
    create.add_argument("--avatar")
    create.add_argument("--pin", required=True)
    for command in ("set-pin", "unlock"):
        p = sub.add_parser(command)
        p.add_argument("--family", type=int, default=1)
        p.add_argument("--name", required=True)
        if command == "set-pin":
            p.add_argument("--pin", required=True)
    asyncio.run(_run(parser.parse_args()))


if __name__ == "__main__":
    main()
