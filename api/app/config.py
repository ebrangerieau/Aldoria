from functools import lru_cache
from typing import Literal

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
    # Espace parent : secret posé par Traefik sur l'hôte admin (vide = API parent fermée).
    admin_key: str = ""
    # Adresse publique de l'espace parent, pour les liens d'invitation (accounts.py).
    admin_url: str = "http://localhost:5173"
    # Questions proposées par l'IA (engine/ai_author.py) : clé d'API Anthropic (vide =
    # fonction désactivée), modèle, effort de réflexion (low, medium, high, xhigh, max) et
    # nombre de demandes par famille et par jour.
    anthropic_api_key: str = ""
    ai_model: str = "claude-sonnet-5-5"
    ai_effort: Literal["low", "medium", "high", "xhigh", "max"] = "medium"
    ai_daily_limit: int = 20
    # Dossier où le service « backup » écrit l'état des sauvegardes (vide = non configuré).
    backup_status_dir: str = ""

    def check(self) -> None:
        if self.environment == "prod" and self.jwt_secret == DEV_JWT_SECRET:
            raise RuntimeError("ALDORIA_JWT_SECRET doit être défini en production.")
        if self.admin_key and len(self.admin_key) < 32:
            raise RuntimeError("ALDORIA_ADMIN_KEY doit faire au moins 32 caractères.")


@lru_cache
def get_settings() -> Settings:
    return Settings()
