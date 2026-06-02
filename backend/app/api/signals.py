"""最新形态信号聚合端点"""

from collections import defaultdict

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.pattern_signal import PatternSignal

router = APIRouter(prefix="/signals", tags=["signals"])

_STOCK_NAMES: dict[str, tuple[str, str]] = {
    "000001": ("平安银行", "sz"),
    "000002": ("万科A", "sz"),
    "000333": ("美的集团", "sz"),
    "000568": ("泸州老窖", "sz"),
    "000651": ("格力电器", "sz"),
    "000858": ("五粮液", "sz"),
    "002142": ("宁波银行", "sz"),
    "002415": ("海康威视", "sz"),
    "002594": ("比亚迪", "sz"),
    "300750": ("宁德时代", "sz"),
    "600000": ("浦发银行", "sh"),
    "600009": ("上海机场", "sh"),
    "600028": ("中国石化", "sh"),
    "600030": ("中信证券", "sh"),
    "600036": ("招商银行", "sh"),
    "600048": ("保利发展", "sh"),
    "600276": ("恒瑞医药", "sh"),
    "600309": ("万华化学", "sh"),
    "600519": ("贵州茅台", "sh"),
    "600585": ("海螺水泥", "sh"),
    "600809": ("山西汾酒", "sh"),
    "600887": ("伊利股份", "sh"),
    "600900": ("长江电力", "sh"),
    "601012": ("隆基绿能", "sh"),
    "601088": ("中国神华", "sh"),
    "601166": ("兴业银行", "sh"),
    "601318": ("中国平安", "sh"),
    "601398": ("工商银行", "sh"),
    "601668": ("中国建筑", "sh"),
    "601888": ("中国中免", "sh"),
}


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
