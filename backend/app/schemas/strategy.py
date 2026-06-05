"""策略相关 schemas"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

VALID_FIELDS = Literal[
    "open", "high", "low", "close", "volume",
    "ma5", "ma20", "ma60", "ma120",
    "volume_ratio_20", "high_20", "pattern",
]
VALID_OPERATORS = Literal[
    "gt", "lt", "eq", "cross_above", "cross_below", "pattern",
]


class StrategyCondition(BaseModel):
    field: VALID_FIELDS
    operator: VALID_OPERATORS
    value: float | None = None
    field2: str | None = None
    pattern_id: str | None = None


class StrategyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    conditions: list[StrategyCondition] = Field(default_factory=list, max_length=10)


class StrategyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    conditions: list[StrategyCondition] | None = Field(default=None, max_length=10)
    enabled: bool | None = None


class StrategyOut(BaseModel):
    id: int
    name: str
    description: str
    conditions: list[StrategyCondition]
    is_builtin: bool
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StrategyListResponse(BaseModel):
    items: list[StrategyOut]
    total: int


class StrategyRunOut(BaseModel):
    id: int
    strategy_id: int
    stock_code: str
    stock_name: str
    matched_at: datetime
    details: dict

    model_config = {"from_attributes": True}


class StrategyRunListResponse(BaseModel):
    items: list[StrategyRunOut]
    total: int


class StrategyScanResponse(BaseModel):
    strategy_id: int
    strategy_name: str
    scanned_at: datetime
    total_scanned: int
    total_matched: int
    results: list[StrategyRunOut]
