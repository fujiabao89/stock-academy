"""应用配置管理 — Pydantic Settings + .env"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # 应用
    app_name: str = "stock-academy"
    debug: bool = False
    environment: str = "development"

    # PostgreSQL
    database_url: str = "postgresql+asyncpg://postgres:postgres@db:5432/stock_academy"
    database_url_sync: str = "postgresql+psycopg2://postgres:postgres@db:5432/stock_academy"

    # Redis (MVP 可选)
    redis_url: str = "redis://redis:6379/0"

    # 行情数据 API
    stock_api_timeout: int = 10  # 秒
    stock_api_base_url_sina: str = "https://hq.sinajs.cn"
    stock_api_base_url_tencent: str = "https://qt.gtimg.cn"

    # 形态匹配引擎
    pattern_match_batch_size: int = 100
    backtest_years: int = 10


settings = Settings()
