from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration lue dans les variables d'environnement (voir deploy/.env.example)."""

    model_config = SettingsConfigDict(env_prefix="ALDORIA_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://aldoria:aldoria@localhost:5432/aldoria"
    # Origines autorisées en développement local (éditeur Godot « Run in Browser »).
    cors_origins: list[str] = []


@lru_cache
def get_settings() -> Settings:
    return Settings()
