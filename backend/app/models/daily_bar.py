"""日线数据模型 — 每只股票每日一条记录"""

from datetime import date

from sqlalchemy import Date, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class DailyBar(Base):
    __tablename__ = "daily_bars"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(10), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    open: Mapped[float] = mapped_column(Float)
    high: Mapped[float] = mapped_column(Float)
    low: Mapped[float] = mapped_column(Float)
    close: Mapped[float] = mapped_column(Float)
    volume: Mapped[int] = mapped_column(Integer)
    amount: Mapped[float] = mapped_column(Float)
    ma5: Mapped[float | None] = mapped_column(Float, nullable=True)
    ma20: Mapped[float | None] = mapped_column(Float, nullable=True)
    ma60: Mapped[float | None] = mapped_column(Float, nullable=True)
    ma120: Mapped[float | None] = mapped_column(Float, nullable=True)
