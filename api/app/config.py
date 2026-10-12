from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-change-me-dev-only-change-me"  # ≥ 32 octets (HS256)


class Settings(BaseSettings):
    """Configuration lue dans les variables d'environnement (voir deploy/.env.example)."""

    model_config = SettingsConfigDict(env_prefix="ALDORIA_", env_file=".env", extra="ignore")

    environment: str = "dev"  # « prod » sur le VPS
    database_url: str = "postgresql+asyncpg://aldoria:aldoria@localhost:5432/aldoria"
    jwt_secret: str = DEV_JWT_SECRET
    token_hours: int = 12
    # Connexion enfant : 5 essais puis blocage 5 minutes (TRD §8).
    max_failed_logins: int = 5
    lock_minutes: int = 5
    # Origines autorisées en développement local (éditeur Godot « Run in Browser »).
    cors_origins: list[str] = []
    # Espace parent : secret posé par Traefik sur l'hôte admin (vide = API parent fermée)
    # et identités SSO autorisées, séparées par des virgules (« * » : toute personne
    # authentifiée par TinyAuth).
    admin_key: str = ""
    admin_users: str = ""
    # Dossier où le service « backup » écrit l'état des sauvegardes (vide = non configuré).
    backup_status_dir: str = ""

    def admin_user_list(self) -> set[str]:
        return {u.strip().lower() for u in self.admin_users.split(",") if u.strip()}

    def check(self) -> None:
        if self.environment == "prod" and self.jwt_secret == DEV_JWT_SECRET:
            raise RuntimeError("ALDORIA_JWT_SECRET doit être défini en production.")
        if self.admin_key and len(self.admin_key) < 32:
            raise RuntimeError("ALDORIA_ADMIN_KEY doit faire au moins 32 caractères.")


@lru_cache
def get_settings() -> Settings:
    return Settings()
