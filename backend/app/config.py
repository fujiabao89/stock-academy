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

    # 股票数据源: baostock (默认) | tushare
    stock_data_source: str = "baostock"

    # Tushare 行情数据
    tushare_token: str = ""
    tushare_request_delay: float = 1.5

    # JWT 认证
    jwt_secret: str = "change-me-in-production-use-a-random-64-char-string"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # 速率限制
    rate_limit_enabled: bool = True
    rate_limit_default: str = "30/minute"

    # DeepSeek AI
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    deepseek_rate_per_minute: int = 10
    deepseek_daily_limit: int = 200
    deepseek_batch_size: int = 10

    # 新闻爬虫
    news_crawl_interval_minutes: int = 30
    news_max_per_crawl: int = 20

    # 形态匹配引擎
    pattern_match_batch_size: int = 100
    backtest_years: int = 10


settings = Settings()
