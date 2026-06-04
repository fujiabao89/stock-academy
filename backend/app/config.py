"""应用配置管理 — Pydantic Settings + .env"""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _fix_render_db_url(v: str) -> str:
    """Render 提供的 DATABASE_URL 使用 postgres:// 前缀，转为 asyncpg 格式"""
    if v.startswith("postgres://"):
        return v.replace("postgres://", "postgresql+asyncpg://", 1)
    if v.startswith("postgresql://"):
        return v.replace("postgresql://", "postgresql+asyncpg://", 1)
    return v


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

    # 自动转换 Render/其他平台的数据库 URL 格式
    _fix_db_url = field_validator("database_url", mode="before")(_fix_render_db_url)

    # Redis (MVP 可选)
    redis_url: str = "redis://redis:6379/0"

    # 行情数据 API
    stock_api_timeout: int = 10  # 秒
    stock_api_base_url_sina: str = "https://hq.sinajs.cn"
    stock_api_base_url_tencent: str = "https://qt.gtimg.cn"

    # Tushare 行情数据
    tushare_token: str = ""
    tushare_request_delay: float = 0.6

    # 速率限制
    rate_limit_enabled: bool = True
    rate_limit_default: str = "30/minute"

    # 形态匹配引擎
    pattern_match_batch_size: int = 100
    backtest_years: int = 10


settings = Settings()
