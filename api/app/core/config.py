from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Image API"
    app_env: str = "development"
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    openai_api_key: str
    image_model_default: str = "gpt-image-2"
    image_model_allowlist: str = "gpt-image-2"
    local_storage_dir: str = "uploads"
    billing_cost_multiplier: float = 10.0
    openai_image_input_text_usd_per_1m: float = 5.0
    openai_image_input_image_usd_per_1m: float = 8.0
    openai_image_output_text_usd_per_1m: float = 0.0
    openai_image_output_image_usd_per_1m: float = 40.0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
