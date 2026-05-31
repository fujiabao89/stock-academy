"""股票相关 Pydantic schemas"""

from datetime import date

from pydantic import BaseModel, Field


class StockSearchResult(BaseModel):
    code: str
    name: str
    market: str = Field(description="sh/sz/bj")


class StockOverview(BaseModel):
    code: str
    name: str
    market: str
    latest_price: float
    change_pct: float
    volume: int
    amount: float
    update_time: str


class KlineItem(BaseModel):
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: int
    ma5: float | None = None
    ma20: float | None = None
    ma60: float | None = None
    ma120: float | None = None
