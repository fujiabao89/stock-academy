"""形态相关 Pydantic schemas"""

from pydantic import BaseModel, Field


class BacktestWindow(BaseModel):
    win_rate: float
    avg_return: float
    occurrences: int


class PatternStats(BaseModel):
    forward_5d: BacktestWindow
    forward_10d: BacktestWindow
    forward_20d: BacktestWindow
    win_rate_bull: float | None = None
    win_rate_bear: float | None = None
    win_rate_shock: float | None = None
    sample_period: str
    max_return: float | None = None
    max_loss: float | None = None


class PatternSignalOut(BaseModel):
    code: str
    date: str
    pattern_id: str
    pattern_name: str
    category: str
    direction: str
    confidence: float
    description: str
    backtest: BacktestWindow | None = Field(
        default=None, description="forward_20d 汇总数据"
    )
    limitations: list[str] = Field(default_factory=list)
    related_patterns: list[str] = Field(default_factory=list)


class PatternDetail(BaseModel):
    pattern_id: str
    pattern_name: str
    category: str
    description: str
    determination: str = Field(description="判定逻辑白话解释")
    backtest: PatternStats
    limitations: list[str]
    related_patterns: list[str]
