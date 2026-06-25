"""
Application configuration using pydantic-settings.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    APP_NAME: str = "DataForge AI"
    APP_VERSION: str = "0.1.0"
    # Secure by default: production must explicitly opt into debug behaviour.
    # Local development should set DEBUG=true in its .env file.
    DEBUG: bool = False

    # Server
    HOST: str = "0.0.0.0"  # nosec B104
    PORT: int = 8000

    # Authentication
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # PostgreSQL
    POSTGRES_USER: str = "dataforge"
    POSTGRES_PASSWORD: str = "secure_pass"
    POSTGRES_DB: str = "dataforge_ai"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432

    DATABASE_URL: str = "postgresql://dataforge:secure_pass@postgres:5432/dataforge_ai"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Object storage (S3-compatible: AWS S3, MinIO, Cloudflare R2)
    # STORAGE_ENDPOINT_URL is set for MinIO/R2 (e.g. http://minio:9000) and left
    # empty/None for native AWS S3.
    STORAGE_ENDPOINT_URL: str | None = None
    STORAGE_REGION: str = "us-east-1"
    STORAGE_BUCKET: str = "dataforge"
    STORAGE_ACCESS_KEY: str = ""
    STORAGE_SECRET_KEY: str = ""
    STORAGE_USE_SSL: bool = False
    # Maximum accepted upload size in bytes (mirrors the frontend cap).
    MAX_UPLOAD_BYTES: int = 500 * 1024 * 1024  # 500 MB

    # AI Providers
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    # AI / LLM gateway
    # Allow the deterministic MockProvider ONLY when explicitly enabled and no
    # real provider key is configured (local/offline/CI). Never silent in prod.
    AI_ALLOW_MOCK: bool = False
    LLM_SMART_MODEL: str = "gpt-4o"
    LLM_FAST_MODEL: str = "gpt-4o-mini"
    LLM_VISION_MODEL: str = "gpt-4o"
    LLM_EMBED_MODEL: str = "text-embedding-3-small"
    LLM_EMBED_DIM: int = 1536
    LLM_REQUEST_TIMEOUT: float = 60.0
    LLM_MAX_RETRIES: int = 2

    # RAG / semantic search
    RAG_TOP_K: int = 5
    RAG_CHUNK_CHARS: int = 1200
    RAG_CHUNK_OVERLAP: int = 150

    # Per-workspace monthly LLM spend cap in USD (0 = unlimited).
    LLM_MONTHLY_COST_CAP_USD: float = 0.0

    # Monitoring
    SENTRY_DSN: str = ""

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
