from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_HOST: str
    DATABASE_PORT: int = 5432
    DATABASE_NAME: str
    DATABASE_USER: str
    DATABASE_PASSWORD: str
    DATABASE_TYPE: str = "postgresql"

    APP_NAME: str = "Inverum"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    SECRET_KEY: str

    VALKEY_URL: str = "valkey://localhost:6379/0"
    VALKEY_PASSWORD: str = ""

    ENVIRONMENT: str = "dev"
    SEED_COMPLEXITY: str = "simple"

    INTERNAL_API_KEY: str = "change-me-in-production"

    OTEL_ENABLED: bool = False
    OTEL_ENDPOINT: str = "http://localhost:4317"
    OTEL_SERVICE_NAME: str = "inverum"

    DATABASE_REPORTING_URL: str = ""
    # postgresql://haproxy:5001/inverumdb — standby replica for readiness check

    DELL_API_KEY: str = ""
    DELL_API_SECRET: str = ""

    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "inverum"
    MINIO_SECRET_KEY: str = "devpassword"
    MINIO_BUCKET: str = "inverum-dev"
    MINIO_SECURE: bool = False

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.DATABASE_USER}:{self.DATABASE_PASSWORD}@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"

    class Config:
        env_file = ".env"

settings = Settings()
