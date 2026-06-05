"""最新形态信号聚合端点"""

from collections import defaultdict

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.pattern_signal import PatternSignal
from ..stock_names import _STOCK_NAMES

router = APIRouter(prefix="/signals", tags=["signals"])


class PatternBrief(BaseModel):
    pattern_id: str
    pattern_name: str
    direction: str
    category: str


class LatestStockSignal(BaseModel):
    code: str
    stock_name: str
    date: str
    patterns: list[PatternBrief]


@router.get("/latest", response_model=list[LatestStockSignal])
async def get_latest_signals(db: AsyncSession = Depends(get_db)):
    """最新日期的全部形态信号，按股票分组"""
    latest_date = await db.execute(
        select(func.max(PatternSignal.date))
    )
    latest_date = latest_date.scalar()
    if latest_date is None:
        return []

    rows = await db.execute(
        select(PatternSignal)
        .where(PatternSignal.date == latest_date)
        .order_by(PatternSignal.code, PatternSignal.pattern_id)
    )
    signals = list(rows.scalars().all())

    grouped = defaultdict(list)
    for s in signals:
        grouped[s.code].append(
            PatternBrief(
                pattern_id=s.pattern_id,
                pattern_name=s.pattern_name,
                direction=s.direction,
                category=s.category,
            )
        )

    result = []
    for code in sorted(grouped.keys()):
        info = _STOCK_NAMES.get(code)
        stock_name = info[0] if info else code
        result.append(
            LatestStockSignal(
                code=code,
                stock_name=stock_name,
                date=str(latest_date),
                patterns=grouped[code],
            )
        )

    return result
