"""Application settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="UDA_", env_file=(".env", "apps/server/.env"), extra="ignore")

    app_name: str = "UDA-StrokeSeg Demo API"
    api_prefix: str = "/api/v1"
    demo_mode: bool = True
    database_url: str = "postgresql+psycopg://uda:uda_dev_password@localhost:5432/uda_strokeseg"
    kafka_bootstrap_servers: str = "localhost:9092"
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
    zoom_refresh_token: str = ""
    zoom_redirect_uri: str = "https://uda-strokeseg.vercel.app/api/v1/zoom/callback"
    zoom_host_user_id: str = "me"
    zoom_sdk_version: str = "6.10.0"
    zoom_webhook_secret: str = ""


settings = Settings()
