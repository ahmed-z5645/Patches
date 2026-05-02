from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    frontend_url: str = "http://localhost:3000"
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_contact_email: str = "admin@edition.app"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
