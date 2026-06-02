"""形态相关 API 端点"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..engine import get, list_all
from ..models.pattern_signal import PatternSignal
from ..schemas.pattern import (
    BacktestWindow,
    PatternDetail,
    PatternSignalOut,
    PatternStats,
)
from ..schemas.stock import StockSearchResult
from pydantic import BaseModel

router = APIRouter(prefix="/patterns", tags=["patterns"])


class PatternSummary(BaseModel):
    pattern_id: str
    pattern_name: str
    category: str
    direction: str
    description: str
    win_rate_20d: float | None = None
    related_count: int


@router.get("", response_model=list[PatternSummary])
async def list_patterns():
    """列出全部已注册的形态"""
    result = []
    for d in list_all().values():
        bt = _BACKTEST_DATA.get(d.pattern_id, {}).get("forward_20d", {})
        wr = bt.get("win_rate") if bt else None
        result.append(PatternSummary(
            pattern_id=d.pattern_id,
            pattern_name=d.pattern_name,
            category=d.category,
            direction=d.direction,
            description=d.describe(),
            win_rate_20d=wr,
            related_count=len(_get_related(d.pattern_id)),
        ))
    return result

# 回测数据（基于 2019-2026 年 30 只沪深300 成分股真实行情回测）
_BACKTEST_DATA: dict[str, dict] = {
    "ma-bullish-alignment": {
        "forward_5d": {"win_rate": 0.501, "avg_return": 0.0432, "occurrences": 4082},
        "forward_10d": {"win_rate": 0.624, "avg_return": 0.0640, "occurrences": 4082},
        "forward_20d": {"win_rate": 0.715, "avg_return": 0.0933, "occurrences": 4071},
        "sample_period": "2019-2026",
        "max_return": 1.0583,
        "max_loss": -0.0819,
    },
    "volume-up-price-up": {
        "forward_5d": {"win_rate": 0.478, "avg_return": 0.0471, "occurrences": 2735},
        "forward_10d": {"win_rate": 0.596, "avg_return": 0.0632, "occurrences": 2733},
        "forward_20d": {"win_rate": 0.700, "avg_return": 0.0875, "occurrences": 2720},
        "sample_period": "2019-2026",
        "max_return": 0.7006,
        "max_loss": -0.1000,
    },
    "volume-price-divergence": {
        "forward_5d": {"win_rate": 0.420, "avg_return": 0.0333, "occurrences": 307},
        "forward_10d": {"win_rate": 0.554, "avg_return": 0.0455, "occurrences": 307},
        "forward_20d": {"win_rate": 0.694, "avg_return": 0.0640, "occurrences": 307},
        "sample_period": "2019-2026",
        "max_return": 0.3891,
        "max_loss": -0.0214,
    },
    "ma-convergence-breakout": {
        "forward_5d": {"win_rate": 0.350, "avg_return": 0.0293, "occurrences": 11454},
        "forward_10d": {"win_rate": 0.497, "avg_return": 0.0431, "occurrences": 11445},
        "forward_20d": {"win_rate": 0.621, "avg_return": 0.0638, "occurrences": 11394},
        "sample_period": "2019-2026",
        "max_return": 0.7384,
        "max_loss": -0.1000,
    },
    "golden-cross": {
        "forward_5d": {"win_rate": 0.392, "avg_return": 0.0338, "occurrences": 1415},
        "forward_10d": {"win_rate": 0.543, "avg_return": 0.0494, "occurrences": 1415},
        "forward_20d": {"win_rate": 0.653, "avg_return": 0.0734, "occurrences": 1413},
        "sample_period": "2019-2026",
        "max_return": 0.7202,
        "max_loss": -0.1000,
    },
    "death-cross": {
        "forward_5d": {"win_rate": 0.386, "avg_return": 0.0302, "occurrences": 1433},
        "forward_10d": {"win_rate": 0.563, "avg_return": 0.0447, "occurrences": 1427},
        "forward_20d": {"win_rate": 0.689, "avg_return": 0.0642, "occurrences": 1415},
        "sample_period": "2019-2026",
        "max_return": 0.3368,
        "max_loss": -0.0340,
    },
    "ma-bearish-alignment": {
        "forward_5d": {"win_rate": 0.409, "avg_return": 0.0313, "occurrences": 5827},
        "forward_10d": {"win_rate": 0.544, "avg_return": 0.0445, "occurrences": 5753},
        "forward_20d": {"win_rate": 0.664, "avg_return": 0.0627, "occurrences": 5662},
        "sample_period": "2019-2026",
        "max_return": 0.3062,
        "max_loss": -0.0356,
    },
    "volume-up-price-down": {
        "forward_5d": {"win_rate": 0.459, "avg_return": 0.0350, "occurrences": 1613},
        "forward_10d": {"win_rate": 0.575, "avg_return": 0.0477, "occurrences": 1613},
        "forward_20d": {"win_rate": 0.669, "avg_return": 0.0639, "occurrences": 1601},
        "sample_period": "2019-2026",
        "max_return": 0.6807,
        "max_loss": -0.0500,
    },
}


@router.get("/{pattern_id}", response_model=PatternDetail)
async def get_pattern_detail(pattern_id: str):
    """形态教学详情（定义、回测数据）"""
    detector = get(pattern_id)
    if detector is None:
        raise HTTPException(status_code=404, detail=f"未知形态: {pattern_id}")

    bt_data = _BACKTEST_DATA.get(pattern_id, {})
    stats = PatternStats(
        forward_5d=BacktestWindow(**bt_data.get("forward_5d", {"win_rate": None, "avg_return": None, "occurrences": 0})),
        forward_10d=BacktestWindow(**bt_data.get("forward_10d", {"win_rate": None, "avg_return": None, "occurrences": 0})),
        forward_20d=BacktestWindow(**bt_data.get("forward_20d", {"win_rate": None, "avg_return": None, "occurrences": 0})),
        sample_period=bt_data.get("sample_period", "2016-2026"),
        max_return=bt_data.get("max_return"),
        max_loss=bt_data.get("max_loss"),
    )

    return PatternDetail(
        pattern_id=detector.pattern_id,
        pattern_name=detector.pattern_name,
        category=detector.category,
        direction=detector.direction,
        description=detector.describe(),
        determination=_get_determination(pattern_id),
        backtest=stats,
        limitations=detector.limitations(),
        related_patterns=_get_related(pattern_id),
    )


@router.get("/{pattern_id}/stocks", response_model=list[PatternSignalOut])
async def get_pattern_stocks(pattern_id: str, db: AsyncSession = Depends(get_db)):
    """最新日期触发该形态的所有股票"""
    from ..api.stocks import _stock_info

    # 找到该形态在 pattern_signals 表中的最新日期
    latest_date = await db.execute(
        select(func.max(PatternSignal.date)).where(PatternSignal.pattern_id == pattern_id)
    )
    latest_date = latest_date.scalar()
    if latest_date is None:
        return []

    signals = await db.execute(
        select(PatternSignal)
        .where(PatternSignal.pattern_id == pattern_id, PatternSignal.date == latest_date)
        .order_by(PatternSignal.code)
    )
    signals = list(signals.scalars().all())

    results = []
    for s in signals:
        bt = s.backtest or {}
        backtest = None
        if bt.get("forward_20d"):
            backtest = BacktestWindow(**bt["forward_20d"])

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


def _get_determination(pattern_id: str) -> str:
    """返回形态判定逻辑的白话解释"""
    determinations = {
        "ma-bullish-alignment": "MA5 > MA20 > MA60 > MA120，且四条均线均在昨日基础上继续向上倾斜。每条均线都不能为None，且必须严格递增排列。需要前5根K线都有均线数据。",
        "ma-bearish-alignment": "MA5 < MA20 < MA60 < MA120，且四条均线均在昨日基础上继续向下倾斜。与多头排列完全对称，方向相反。",
        "golden-cross": "昨日 MA5 ≤ MA20，今日 MA5 > MA20，即短期均线从下方上穿长期均线。仅比较昨日和今日两根K线的MA值。",
        "death-cross": "昨日 MA5 ≥ MA20，今日 MA5 < MA20，即短期均线从上方下穿长期均线。仅比较昨日和今日两根K线的MA值。",
        "volume-up-price-up": "当日涨幅 > 1% 且 成交量/20日均量 > 1.5。成交量比率 = bar.volume / avg(前20根bar的volume)。",
        "volume-up-price-down": "当日跌幅 > 1% 且 成交量/20日均量 > 1.5。与放量上涨对称，方向相反。",
        "ma-convergence-breakout": "过去20个交易日，每日 MA5/MA20/MA60 三条均线距离均 < 5%（均线粘合），且今日 MA5 向上突破（高于昨日 MA5）。",
        "volume-price-divergence": "股价创20日新高（今日高点 > 前20日所有高点），但成交量/20日均量 < 0.8（缩量新高）。",
    }
    return determinations.get(pattern_id, "暂无详细判定逻辑说明")


def _get_related(pattern_id: str) -> list[str]:
    """返回相关形态ID"""
    related = {
        "ma-bullish-alignment": ["ma-bearish-alignment", "golden-cross", "ma-convergence-breakout"],
        "ma-bearish-alignment": ["ma-bullish-alignment", "death-cross"],
        "golden-cross": ["death-cross", "ma-bullish-alignment"],
        "death-cross": ["golden-cross", "ma-bearish-alignment"],
        "volume-up-price-up": ["volume-up-price-down", "volume-price-divergence"],
        "volume-up-price-down": ["volume-up-price-up", "volume-price-divergence"],
        "ma-convergence-breakout": ["ma-bullish-alignment", "golden-cross"],
        "volume-price-divergence": ["volume-up-price-up", "volume-up-price-down"],
    }
    return related.get(pattern_id, [])
