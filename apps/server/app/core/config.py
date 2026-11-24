"""App settings for the lecturer demo API (in-memory, no external DB)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="UDA_", env_file=".env", extra="ignore")

    app_name: str = "UDA-StrokeSeg Demo API"
    api_prefix: str = "/api/v1"
    demo_mode: bool = True
    demo_password: str = "Pass@123"
    cors_origins: list[str] = [
        "http://localhost:8443",
        "http://127.0.0.1:8443",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Zoom Meeting REST + Meeting SDK. Values come from apps/server/.env only.
    # General app: client id/secret are also the SDK key/secret. S2S adds account id.
    zoom_account_id: str = ""
    zoom_client_id: str = ""
    zoom_client_secret: str = ""
    zoom_sdk_key: str = ""
    zoom_sdk_secret: str = ""
    zoom_redirect_uri: str = "http://127.0.0.1:8000/api/v1/zoom/callback"
    zoom_host_user_id: str = "me"
    zoom_sdk_version: str = "2.18.1"
    zoom_webhook_secret: str = ""


settings = Settings()
