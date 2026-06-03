"""形态相关 Pydantic schemas"""

from pydantic import BaseModel, Field


class BacktestWindow(BaseModel):
    win_rate: float | None
    avg_return: float | None
    occurrences: int


class RandomBaseline(BaseModel):
    """随机入场基线统计"""
    win_rate: float | None
    avg_return: float | None
    occurrences: int


class DistributionBin(BaseModel):
    """收益分布直方图的单个桶"""
    bin_start: float
    bin_end: float
    count: int


class RegimeSplit(BaseModel):
    """单个市场环境下的回测统计"""
    regime: str   # "bull" | "bear" | "shock"
    label: str    # 中文显示标签
    win_rate: float | None
    avg_return: float | None
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
    distribution: list[DistributionBin] | None = Field(
        default=None, description="20日窗口收益分布直方图"
    )
    regime_splits: list[RegimeSplit] | None = Field(
        default=None, description="20日窗口牛熊市拆分统计"
    )
    confidence_grade: str | None = Field(
        default=None, description="信心等级 A/B/C，综合胜率和样本量"
    )
    random_baseline: RandomBaseline | None = Field(
        default=None, description="20日窗口随机入场基线（同等样本数）"
    )


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
    direction: str
    description: str
    determination: str = Field(description="判定逻辑白话解释")
    backtest: PatternStats
    limitations: list[str]
    related_patterns: list[str]
