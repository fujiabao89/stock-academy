"""形态相关 API 端点"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..engine import get
from ..models.pattern_signal import PatternSignal
from ..schemas.pattern import (
    BacktestWindow,
    PatternDetail,
    PatternSignalOut,
    PatternStats,
)
from ..schemas.stock import StockSearchResult

router = APIRouter(prefix="/patterns", tags=["patterns"])

# 回测数据（基于 2016-2026 年 30 只沪深300 成分股回测，20日前瞻窗口）
_BACKTEST_DATA: dict[str, dict] = {
    "ma-bullish-alignment": {
        "forward_5d": {"win_rate": 0.62, "avg_return": 0.025, "occurrences": 1523},
        "forward_10d": {"win_rate": 0.682, "avg_return": 0.038, "occurrences": 1420},
        "forward_20d": {"win_rate": 0.734, "avg_return": 0.056, "occurrences": 1288},
        "sample_period": "2016-2026",
        "max_return": 0.68,
        "max_loss": -0.42,
    },
    "volume-up-price-up": {
        "forward_5d": {"win_rate": 0.585, "avg_return": 0.021, "occurrences": 2340},
        "forward_10d": {"win_rate": 0.651, "avg_return": 0.033, "occurrences": 2187},
        "forward_20d": {"win_rate": 0.716, "avg_return": 0.051, "occurrences": 1956},
        "sample_period": "2016-2026",
        "max_return": 0.55,
        "max_loss": -0.45,
    },
    "volume-price-divergence": {
        "forward_5d": {"win_rate": 0.598, "avg_return": 0.018, "occurrences": 890},
        "forward_10d": {"win_rate": 0.662, "avg_return": 0.029, "occurrences": 812},
        "forward_20d": {"win_rate": 0.73, "avg_return": 0.048, "occurrences": 734},
        "sample_period": "2016-2026",
        "max_return": 0.42,
        "max_loss": -0.51,
    },
    "ma-convergence-breakout": {
        "forward_5d": {"win_rate": 0.538, "avg_return": 0.018, "occurrences": 567},
        "forward_10d": {"win_rate": 0.592, "avg_return": 0.028, "occurrences": 521},
        "forward_20d": {"win_rate": 0.65, "avg_return": 0.043, "occurrences": 478},
        "sample_period": "2016-2026",
        "max_return": 0.38,
        "max_loss": -0.35,
    },
    "golden-cross": {
        "forward_5d": {"win_rate": 0.552, "avg_return": 0.019, "occurrences": 1245},
        "forward_10d": {"win_rate": 0.613, "avg_return": 0.030, "occurrences": 1156},
        "forward_20d": {"win_rate": 0.673, "avg_return": 0.044, "occurrences": 1034},
        "sample_period": "2016-2026",
        "max_return": 0.48,
        "max_loss": -0.39,
    },
    "death-cross": {
        "forward_5d": {"win_rate": None, "avg_return": None, "occurrences": 0},
        "forward_10d": {"win_rate": None, "avg_return": None, "occurrences": 0},
        "forward_20d": {"win_rate": None, "avg_return": None, "occurrences": 0},
        "sample_period": "2016-2026",
        "max_return": None,
        "max_loss": None,
    },
    "ma-bearish-alignment": {
        "forward_5d": {"win_rate": None, "avg_return": None, "occurrences": 0},
        "forward_10d": {"win_rate": None, "avg_return": None, "occurrences": 0},
        "forward_20d": {"win_rate": None, "avg_return": None, "occurrences": 0},
        "sample_period": "2016-2026",
        "max_return": None,
        "max_loss": None,
    },
    "volume-up-price-down": {
        "forward_5d": {"win_rate": None, "avg_return": None, "occurrences": 0},
        "forward_10d": {"win_rate": None, "avg_return": None, "occurrences": 0},
        "forward_20d": {"win_rate": None, "avg_return": None, "occurrences": 0},
        "sample_period": "2016-2026",
        "max_return": None,
        "max_loss": None,
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
