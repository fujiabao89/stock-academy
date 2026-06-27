"""策略 + 策略运行结果模型"""

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

_jsonb_type = JSONB().with_variant(JSON(), "sqlite")


class Strategy(Base):
    __tablename__ = "strategies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(500), default="")
    conditions: Mapped[list[dict]] = mapped_column(_jsonb_type, default=list)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    runs: Mapped[list["StrategyRun"]] = relationship(
        "StrategyRun", back_populates="strategy", cascade="all, delete-orphan"
    )
    backtests: Mapped[list["StrategyBacktest"]] = relationship(
        "StrategyBacktest", back_populates="strategy", cascade="all, delete-orphan"
    )


class StrategyRun(Base):
    __tablename__ = "strategy_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    strategy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("strategies.id", ondelete="CASCADE"), index=True
    )
    stock_code: Mapped[str] = mapped_column(String(10))
    stock_name: Mapped[str] = mapped_column(String(50))
    matched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    details: Mapped[dict] = mapped_column(_jsonb_type, default=dict)

    strategy: Mapped["Strategy"] = relationship("Strategy", back_populates="runs")


class StrategyBacktest(Base):
    """策略回测任务 — 异步执行 + 结果持久化"""

    __tablename__ = "strategy_backtests"

    id: Mapped[int] = mapped_column(primary_key=True)
    strategy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("strategies.id", ondelete="SET NULL"), nullable=True, index=True
    )
    conditions: Mapped[list[dict]] = mapped_column(_jsonb_type, default=list)
    forward_days: Mapped[int] = mapped_column(Integer, default=20)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/running/done/error
    result: Mapped[dict | None] = mapped_column(_jsonb_type, nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    strategy: Mapped["Strategy | None"] = relationship("Strategy", back_populates="backtests")
