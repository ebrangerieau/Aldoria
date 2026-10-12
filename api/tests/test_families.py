"""Plusieurs familles : comptes adultes (connexion, invitations, mot de passe oublié),
cloisonnement entre familles, appareils reliés, effacement d'un enfant ou d'une famille."""

from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import func, select

from app import accounts
from app.config import get_settings
from app.models import Adult, AdultSession, Attempt, BankItem, Family, Invitation, Profile
from tests.conftest import PARENT_EMAIL, PARENT_PASSWORD
from tests.test_admin import ADMIN, KEY, PLAY, admin_settings, parent  # noqa: F401 (fixture)
from tests.test_parent_space import QCM

HOST = {"X-Aldoria-Admin-Key": KEY, "X-Requested-With": "aldoria"}


def _session(response) -> str:
    """Jeton de session posé par la réponse (cookie Secure : httpx ne le garde pas en http)."""
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=strict" in cookie
    assert "Path=/api/v1/admin" in cookie
    return cookie.split(";")[0].split("=", 1)[1]


def _token(link: str) -> str:
    assert "/#invitation=" in link, "jeton dans le fragment : jamais envoyé au serveur"
    return link.split("#invitation=", 1)[1]


async def _operator(sessionmaker) -> None:
    async with sessionmaker() as db:
        (await db.get(Adult, 1)).is_operator = True
        await db.commit()


async def _new_family(client, sessionmaker, email="karine@example.org") -> str:
    """Famille n° 2 créée par invitation de l'exploitant ; renvoie la session de son adulte."""
    await _operator(sessionmaker)
    link = (await client.post(f"{ADMIN}/families/invitations", json={}, headers=parent())).json()
    response = await client.post(
        f"{ADMIN}/invitations/{_token(link['link'])}/accept",
        json={
            "name": "Karine",
            "email": email,
            "password": "un long mot de passe",
            "family_name": "Famille Martin",
        },
        headers=HOST,
    )
    assert response.status_code == 200, response.text
    assert response.json()["family"]["name"] == "Famille Martin"
    return _session(response)


async def test_login_logout_and_lockout(client):
    wrong = await client.post(
        f"{ADMIN}/login", json={"email": PARENT_EMAIL, "password": "pas le bon"}, headers=HOST
    )
    unknown = await client.post(
        f"{ADMIN}/login", json={"email": "x@example.org", "password": "pas le bon"}, headers=HOST
    )
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["error"]["message"] == unknown.json()["error"]["message"]

    ok = await client.post(
        f"{ADMIN}/login",
        json={"email": " Parent@Example.org ", "password": PARENT_PASSWORD},
        headers=HOST,
    )
    assert ok.status_code == 200
    session = _session(ok)
    assert (await client.get(f"{ADMIN}/me", headers=parent(session))).status_code == 200
    assert (await client.post(f"{ADMIN}/logout", headers=parent(session))).status_code == 204
    assert (await client.get(f"{ADMIN}/me", headers=parent(session))).status_code == 401

    for _ in range(5):
        await client.post(
            f"{ADMIN}/login", json={"email": PARENT_EMAIL, "password": "pas le bon"}, headers=HOST
        )
    locked = await client.post(
        f"{ADMIN}/login", json={"email": PARENT_EMAIL, "password": PARENT_PASSWORD}, headers=HOST
    )
    assert locked.status_code == 423


async def test_invite_an_adult(client, sessionmaker):
    created = await client.post(
        f"{ADMIN}/adults/invitations", json={"note": "pour Karine"}, headers=parent()
    )
    assert created.status_code == 201
    token = _token(created.json()["link"])
    listed = (await client.get(f"{ADMIN}/adults", headers=parent())).json()
    assert [i["note"] for i in listed["invitations"]] == ["pour Karine"]

    seen = await client.get(f"{ADMIN}/invitations/{token}", headers=HOST)
    assert seen.json()["kind"] == "adulte" and seen.json()["family"] == "Famille test"
    url = f"{ADMIN}/invitations/{token}/accept"
    form = {"name": "Karine", "email": "karine@example.org", "password": "un long mot de passe"}
    assert (
        await client.post(url, json=form | {"password": "court"}, headers=HOST)
    ).status_code == 422
    assert (
        await client.post(url, json=form | {"email": "pas-un-mail"}, headers=HOST)
    ).status_code == 422
    taken = await client.post(url, json=form | {"email": PARENT_EMAIL}, headers=HOST)
    assert taken.status_code == 409
    accepted = await client.post(url, json=form, headers=HOST)
    assert accepted.status_code == 200
    assert accepted.json()["family"]["id"] == 1
    assert (
        await client.get(f"{ADMIN}/profiles", headers=parent(_session(accepted)))
    ).status_code == 200
    # Une seule fois.
    assert (await client.post(url, json=form, headers=HOST)).status_code == 404
    assert (await client.get(f"{ADMIN}/invitations/{token}", headers=HOST)).status_code == 404

    # Lien expiré.
    expired = _token(
        (await client.post(f"{ADMIN}/adults/invitations", json={}, headers=parent())).json()["link"]
    )
    async with sessionmaker() as db:
        invitation = await db.get(Invitation, accounts.digest(expired))
        invitation.expires_at = datetime.now(UTC) - timedelta(minutes=1)
        await db.commit()
    assert (await client.get(f"{ADMIN}/invitations/{expired}", headers=HOST)).status_code == 404


async def test_forgotten_password_and_adult_removal(client):
    invite = (await client.post(f"{ADMIN}/adults/invitations", json={}, headers=parent())).json()
    form = {"name": "Karine", "email": "karine@example.org", "password": "un long mot de passe"}
    karine = await client.post(
        f"{ADMIN}/invitations/{_token(invite['link'])}/accept", json=form, headers=HOST
    )
    karine_session = _session(karine)
    karine_id = karine.json()["adult"]["id"]

    reset = await client.post(f"{ADMIN}/adults/{karine_id}/password-link", headers=parent())
    token = _token(reset.json()["link"])
    assert (await client.get(f"{ADMIN}/invitations/{token}", headers=HOST)).json()["adult"] == {
        "name": "Karine",
        "email": "karine@example.org",
    }
    done = await client.post(
        f"{ADMIN}/invitations/{token}/accept",
        json={"password": "nouveau mot de passe"},
        headers=HOST,
    )
    assert done.status_code == 200
    # Ses anciennes sessions sont fermées ; le nouveau mot de passe fonctionne.
    assert (await client.get(f"{ADMIN}/me", headers=parent(karine_session))).status_code == 401
    login = await client.post(
        f"{ADMIN}/login",
        json={"email": "karine@example.org", "password": "nouveau mot de passe"},
        headers=HOST,
    )
    assert login.status_code == 200

    assert (await client.delete(f"{ADMIN}/adults/{karine_id}", headers=parent())).status_code == 204
    last = await client.delete(f"{ADMIN}/adults/1", headers=parent())
    assert last.status_code == 422 and last.json()["error"]["code"] == "last_adult"


async def test_change_password_closes_other_sessions(client):
    other = _session(
        await client.post(
            f"{ADMIN}/login",
            json={"email": PARENT_EMAIL, "password": PARENT_PASSWORD},
            headers=HOST,
        )
    )
    url = f"{ADMIN}/me/password"
    bad = await client.put(
        url, json={"current": "faux", "new": "un autre mot de passe"}, headers=parent()
    )
    assert bad.status_code == 422
    ok = await client.put(
        url, json={"current": PARENT_PASSWORD, "new": "un autre mot de passe"}, headers=parent()
    )
    assert ok.status_code == 204
    assert (await client.get(f"{ADMIN}/me", headers=parent(other))).status_code == 401
    assert (await client.get(f"{ADMIN}/me", headers=parent())).status_code == 200


async def test_families_are_sealed_off(client, sessionmaker, profiles, curriculum):
    created = await client.post(
        f"{ADMIN}/bank", json={"level": "6e", "question": QCM}, headers=parent()
    )
    assert created.status_code == 201
    decided = await client.put(
        f"{ADMIN}/notions/2nde.maths.fonctions_reference.racine_cube",
        json={"in_program": False},
        headers=parent(),
    )
    assert decided.status_code == 200
    martin = parent(await _new_family(client, sessionmaker))

    assert (await client.get(f"{ADMIN}/profiles", headers=martin)).json() == []
    for url in (
        f"{ADMIN}/profiles/{profiles['jules']}/dashboard",
        f"{ADMIN}/profiles/{profiles['jules']}/chapters",
        f"{ADMIN}/bank/{created.json()['id']}",
    ):
        assert (await client.get(url, headers=martin)).status_code == 404, url
    assert (
        await client.put(
            f"{ADMIN}/profiles/{profiles['jules']}/pin", json={"pin": "1111"}, headers=martin
        )
    ).status_code == 404
    assert (await client.get(f"{ADMIN}/bank", headers=martin)).json() == []
    assert (await client.get(f"{ADMIN}/reports/count", headers=martin)).json() == {"open": 0}
    decisions = (await client.get(f"{ADMIN}/notions/to-validate", headers=martin)).json()
    assert len(decisions) == 2
    assert all(d["in_program"] is None for d in decisions), "décisions propres à chaque famille"
    ours = (await client.get(f"{ADMIN}/notions/to-validate", headers=parent())).json()
    assert [d["in_program"] for d in ours] == [False, None]
    adults = (await client.get(f"{ADMIN}/adults", headers=martin)).json()["adults"]
    assert [a["name"] for a in adults] == ["Karine"]
    assert (await client.get(f"{ADMIN}/families", headers=martin)).status_code == 403


async def test_children_are_created_and_deleted_by_parents(client, sessionmaker, profiles):
    martin = parent(await _new_family(client, sessionmaker))
    lea = await client.post(
        f"{ADMIN}/profiles", json={"name": "Léa", "level": "2nde", "pin": "1234"}, headers=martin
    )
    assert lea.status_code == 201
    assert lea.json()["world"] == "tom"
    # Même prénom ou même code qu'un enfant de la famille : refusé ; autre famille : libre.
    same = await client.post(
        f"{ADMIN}/profiles", json={"name": "léa", "level": "6e", "pin": "5555"}, headers=martin
    )
    assert same.status_code == 409
    pin = await client.post(
        f"{ADMIN}/profiles", json={"name": "Hugo", "level": "6e", "pin": "1234"}, headers=martin
    )
    assert pin.status_code == 422 and pin.json()["error"]["code"] == "pin_taken"
    jules_bis = await client.post(
        f"{ADMIN}/profiles", json={"name": "Jules", "level": "6e", "pin": "4321"}, headers=martin
    )
    assert jules_bis.status_code == 201

    url = f"{ADMIN}/profiles/{lea.json()['id']}/delete"
    assert (await client.post(url, json={"confirm": "Lea"}, headers=martin)).status_code == 422
    assert (await client.post(url, json={"confirm": "léa"}, headers=martin)).status_code == 204
    names = [p["name"] for p in (await client.get(f"{ADMIN}/profiles", headers=martin)).json()]
    assert names == ["Jules"]


async def test_devices_pair_and_are_revoked(client, sessionmaker, profiles):
    martin = parent(await _new_family(client, sessionmaker))
    await client.post(
        f"{ADMIN}/profiles", json={"name": "Léa", "level": "2nde", "pin": "2468"}, headers=martin
    )
    code = (
        await client.post(f"{ADMIN}/devices/code", json={"name": "Tablette de Léa"}, headers=martin)
    ).json()["code"]
    assert len(code) == 8 and code.isdigit()
    paired = await client.post(f"{PLAY}/devices/pair", json={"code": code})
    assert paired.status_code == 200
    assert paired.json()["family"] == "Famille Martin"
    device = {accounts.DEVICE_HEADER: paired.json()["device_token"]}
    # Le code ne sert qu'une fois ; un code inventé ne marche pas.
    assert (await client.post(f"{PLAY}/devices/pair", json={"code": code})).status_code == 404
    assert (await client.post(f"{PLAY}/devices/pair", json={"code": "12345678"})).status_code == 404

    names = [p["name"] for p in (await client.get(f"{PLAY}/profiles", headers=device)).json()]
    assert names == ["Léa"], "seulement les enfants de la famille de l'appareil"
    jules = await client.post(
        f"{PLAY}/login", json={"profile_id": profiles["jules"], "pin": "1234"}, headers=device
    )
    assert jules.status_code == 404
    lea_id = (await client.get(f"{PLAY}/profiles", headers=device)).json()[0]["id"]
    login = await client.post(
        f"{PLAY}/login", json={"profile_id": lea_id, "pin": "2468"}, headers=device
    )
    child = {"Authorization": f"Bearer {login.json()['token']}"}
    assert (await client.get(f"{PLAY}/me", headers=child)).status_code == 200

    listed = (await client.get(f"{ADMIN}/devices", headers=martin)).json()
    assert [d["name"] for d in listed] == ["Tablette de Léa"]
    removed = await client.delete(f"{ADMIN}/devices/{listed[0]['id']}", headers=martin)
    assert removed.status_code == 204
    gone = await client.get(f"{PLAY}/profiles", headers=device)
    assert gone.status_code == 401 and gone.json()["error"]["code"] == "device_unknown"
    assert (await client.get(f"{PLAY}/me", headers=child)).status_code == 401


async def test_profiles_need_a_paired_device(client, profiles):
    no_device = {accounts.DEVICE_HEADER: ""}
    response = await client.get(f"{PLAY}/profiles", headers=no_device)
    assert response.status_code == 401 and response.json()["error"]["code"] == "device_unknown"
    login = await client.post(
        f"{PLAY}/login", json={"profile_id": profiles["jules"], "pin": "1234"}, headers=no_device
    )
    assert login.status_code == 401
    # Jeton d'avant les appareils (sans « dev ») : refusé, l'enfant se reconnecte.
    old = jwt.encode(
        {
            "sub": str(profiles["jules"]),
            "exp": datetime.now(UTC) + timedelta(hours=1),
            "scope": "play",
        },
        get_settings().jwt_secret,
        algorithm="HS256",
    )
    response = await client.get(f"{PLAY}/me", headers={"Authorization": f"Bearer {old}"})
    assert response.status_code == 401


async def test_a_family_is_erased(client, sessionmaker, profiles, login):
    session = await _new_family(client, sessionmaker)
    martin = parent(session)
    lea = (
        await client.post(
            f"{ADMIN}/profiles", json={"name": "Léa", "level": "6e", "pin": "2468"}, headers=martin
        )
    ).json()
    await client.post(f"{ADMIN}/bank", json={"level": "6e", "question": QCM}, headers=martin)
    await client.post(f"{ADMIN}/devices/code", json={"name": "PC"}, headers=martin)
    url = f"{ADMIN}/family/delete"
    assert (await client.post(url, json={"confirm": "Martin"}, headers=martin)).status_code == 422
    # La famille de l'exploitant ne se supprime pas depuis l'espace parent.
    assert (
        await client.post(url, json={"confirm": "Famille test"}, headers=parent())
    ).status_code == 422
    erased = await client.post(url, json={"confirm": "famille martin"}, headers=martin)
    assert erased.status_code == 204
    assert (await client.get(f"{ADMIN}/me", headers=martin)).status_code == 401
    async with sessionmaker() as db:
        assert await db.get(Family, 2) is None
        assert await db.get(Profile, lea["id"]) is None
        for model in (Adult, BankItem):
            rows = await db.scalar(
                select(func.count()).select_from(model).where(model.family_id == 2)
            )
            assert rows == 0, model
        assert await db.scalar(select(func.count()).select_from(AdultSession)) >= 1
        assert await db.get(Profile, profiles["jules"]) is not None, "les autres familles restent"
        assert await db.scalar(select(func.count()).select_from(Attempt)) == 0


async def test_operator_lists_families(client, sessionmaker, profiles):
    await _new_family(client, sessionmaker)
    families = (await client.get(f"{ADMIN}/families", headers=parent())).json()
    assert [(f["name"], f["children"], f["adults"]) for f in families] == [
        ("Famille test", 2, 1),
        ("Famille Martin", 0, 1),
    ]
    renamed = await client.put(
        f"{ADMIN}/family", json={"name": "Les Brangerieau"}, headers=parent()
    )
    assert renamed.json()["family"]["name"] == "Les Brangerieau"
