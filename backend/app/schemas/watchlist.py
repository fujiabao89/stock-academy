"""自选股相关 Schema"""

from datetime import datetime

from pydantic import BaseModel


class WatchlistItemOut(BaseModel):
    code: str
    name: str
    market: str
    added_at: datetime


class WatchlistResponse(BaseModel):
    items: list[WatchlistItemOut]
    count: int
