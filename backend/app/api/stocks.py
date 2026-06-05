"""股票相关 API 端点"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from .errors import NotFoundError
from ..stock_names import _STOCK_NAMES, stock_info as _stock_info
from ..engine import list_all
from ..models.daily_bar import DailyBar
from ..models.pattern_signal import PatternSignal
from .patterns import _BACKTEST_DATA
from ..schemas.pattern import BacktestWindow, PatternSignalOut
from ..schemas.stock import KlineItem, StockOverview, StockSearchResult

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/search", response_model=list[StockSearchResult])
async def search_stocks(
    q: str = Query(..., min_length=1, description="搜索关键词（代码/名称）"),
    db: AsyncSession = Depends(get_db),
):
    """搜索股票，支持代码和名称模糊匹配（限定数据库中已有数据的股票）"""
    q_upper = q.upper().strip()

    # 先在本地名称映射中匹配
    matched_codes = [
        code for code, (name, _) in _STOCK_NAMES.items()
        if q_upper in code or q_upper in name.upper()
    ]
    if not matched_codes:
        return []

    # 验证匹配的股票在数据库中有数据
    result = await db.execute(
        select(DailyBar.code).where(DailyBar.code.in_(matched_codes)).distinct()
    )
    db_codes = {row[0] for row in result.fetchall()}

    matches = [
        StockSearchResult(code=code, name=_STOCK_NAMES[code][0], market=_STOCK_NAMES[code][1])
        for code in matched_codes if code in db_codes
    ]
    return matches[:20]


@router.get("/{code}/overview", response_model=StockOverview)
async def get_stock_overview(code: str, db: AsyncSession = Depends(get_db)):
    """个股概览（最新价、涨跌幅、基本信息）"""
    if not code.isdigit() or len(code) != 6:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="股票代码格式错误，请输入6位数字代码")

    bars = await db.execute(
        select(DailyBar)
        .where(DailyBar.code == code)
        .order_by(DailyBar.date.desc())
        .limit(2)
    )
    bars = list(bars.scalars().all())

    if not bars:
        raise NotFoundError(detail=f"未找到股票 {code} 的数据")

    today = bars[0]
    info = _stock_info(code)
    name, market = info if info else (code, "sz")

    # 计算涨跌幅
    if len(bars) >= 2:
        prev = bars[1]
        change_pct = round((today.close - prev.close) / prev.close * 100, 2)
    else:
        change_pct = 0.0

    return StockOverview(
        code=code,
        name=name,
        market=market,
        latest_price=today.close,
        change_pct=change_pct,
        volume=today.volume,
        amount=today.amount,
        update_time=str(today.date),
    )


@router.get("/{code}/kline", response_model=list[KlineItem])
async def get_stock_kline(
    code: str,
    period: str = Query("d", pattern="^(d|w|m)$"),
    limit: int = Query(250, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """K线数据（含均线），period: d=日K, w=周K, m=月K"""
    if not code.isdigit() or len(code) != 6:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="股票代码格式错误，请输入6位数字代码")

    if period == "d":
        rows = await db.execute(
            select(DailyBar)
            .where(DailyBar.code == code)
            .order_by(DailyBar.date.desc())
            .limit(limit)
        )
        bars = list(rows.scalars().all())
        bars.reverse()

        if not bars:
            raise NotFoundError(detail=f"未找到股票 {code} 的数据")

        result = [
            KlineItem(
                date=b.date,
                open=b.open,
                high=b.high,
                low=b.low,
                close=b.close,
                volume=b.volume,
                ma5=b.ma5,
                ma20=b.ma20,
                ma60=b.ma60,
                ma120=b.ma120,
            )
            for b in bars
        ]
        return result

    # 聚合为周K/月K 需要全量数据
    rows = await db.execute(
        select(DailyBar)
        .where(DailyBar.code == code)
        .order_by(DailyBar.date.asc())
    )
    bars = list(rows.scalars().all())

    if not bars:
        raise NotFoundError(detail=f"未找到股票 {code} 的数据")

    if period == "w":
        freq = "W"
    else:
        freq = "M"

    df_data = [
        {"date": b.date, "open": b.open, "high": b.high, "low": b.low, "close": b.close, "volume": b.volume}
        for b in bars
    ]

    aggregated = _aggregate_bars(df_data, freq)
    return [KlineItem(**item) for item in aggregated[-limit:]]


def _aggregate_bars(bars: list[dict], freq: str) -> list[dict]:
    """将日线聚合为周K或月K"""
    grouped: dict[str, list[dict]] = {}
    for b in bars:
        d = b["date"]
        if freq == "W":
            key = d.strftime("%Y-%W")
        else:
            key = d.strftime("%Y-%m")
        grouped.setdefault(key, []).append(b)

    result = []
    for key in sorted(grouped.keys()):
        group = grouped[key]
        item = {
            "date": group[-1]["date"],
            "open": group[0]["open"],
            "high": max(b["high"] for b in group),
            "low": min(b["low"] for b in group),
            "close": group[-1]["close"],
            "volume": sum(b["volume"] for b in group),
        }
        result.append(item)
    return result


@router.get("/{code}/signals", response_model=list[PatternSignalOut])
async def get_stock_signals(code: str, db: AsyncSession = Depends(get_db)):
    """该股票的全部形态信号"""
    signals = await db.execute(
        select(PatternSignal)
        .where(PatternSignal.code == code)
        .order_by(PatternSignal.date.desc(), PatternSignal.pattern_id)
    )
    signals = list(signals.scalars().all())

    results = []
    for s in signals:
        bt = s.backtest or {}
        backtest = None
        if bt.get("forward_20d"):
            backtest = BacktestWindow(**bt["forward_20d"])
        elif s.pattern_id in _BACKTEST_DATA:
            bt_data = _BACKTEST_DATA[s.pattern_id]
            if bt_data.get("forward_20d", {}).get("win_rate") is not None:
                backtest = BacktestWindow(**bt_data["forward_20d"])

        results.append(
            PatternSignalOut(
                code=s.code,
                date=str(s.date),
                pattern_id=s.pattern_id,
                pattern_name=s.pattern_name,
                category=s.category,
                direction=s.direction,
                confidence=s.confidence,
                description=s.description,
                backtest=backtest,
                limitations=s.limitations or [],
                related_patterns=s.related_patterns or [],
            )
        )

    return results
