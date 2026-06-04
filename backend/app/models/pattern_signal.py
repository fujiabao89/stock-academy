"""形态信号模型 — 每只股票每个交易日每种形态的匹配结果"""

from datetime import date

from sqlalchemy import JSON, Date, Float, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base

_jsonb_type = JSONB().with_variant(JSON(), "sqlite")


class PatternSignal(Base):
    __tablename__ = "pattern_signals"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(10), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    pattern_id: Mapped[str] = mapped_column(String(50), index=True)
    pattern_name: Mapped[str] = mapped_column(String(50))
    category: Mapped[str] = mapped_column(String(20))
    direction: Mapped[str] = mapped_column(String(10))  # bullish/bearish/neutral
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    description: Mapped[str] = mapped_column(String(500))
    backtest: Mapped[dict] = mapped_column(_jsonb_type)
    limitations: Mapped[list[str]] = mapped_column(_jsonb_type, default=list)
    related_patterns: Mapped[list[str]] = mapped_column(_jsonb_type, default=list)
