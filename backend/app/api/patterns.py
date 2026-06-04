"""形态相关 API 端点"""

import json
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..engine import get, list_all
from .errors import NotFoundError
from ..models.pattern_signal import PatternSignal
from ..schemas.pattern import (
    BacktestWindow,
    DistributionBin,
    PatternDetail,
    PatternSignalOut,
    PatternStats,
    RandomBaseline,
    RegimeSplit,
)
from ..schemas.stock import StockSearchResult
from pydantic import BaseModel

router = APIRouter(prefix="/patterns", tags=["patterns"])


def _load_backtest_data() -> dict[str, dict]:
    json_path = Path(__file__).resolve().parent.parent / "data" / "backtest_data.json"
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        import logging
        logging.getLogger(__name__).warning("无法加载回测数据 %s: %s", json_path, e)
        return {}


_BACKTEST_DATA: dict[str, dict] = _load_backtest_data()


class PatternSummary(BaseModel):
    pattern_id: str
    pattern_name: str
    category: str
    direction: str
    description: str
    win_rate_20d: float | None = None
    related_count: int
    confidence_grade: str | None = None


@router.get("", response_model=list[PatternSummary])
async def list_patterns():
    """列出全部已注册的形态"""
    result = []
    for d in list_all().values():
        bt = _BACKTEST_DATA.get(d.pattern_id, {}).get("forward_20d", {})
        wr = bt.get("win_rate") if bt else None
        occ = bt.get("occurrences", 0) if bt else 0
        result.append(PatternSummary(
            pattern_id=d.pattern_id,
            pattern_name=d.pattern_name,
            category=d.category,
            direction=d.direction,
            description=d.describe(),
            win_rate_20d=wr,
            related_count=len(_get_related(d.pattern_id)),
            confidence_grade=_compute_confidence(wr, occ),
        ))
    return result



@router.get("/{pattern_id}", response_model=PatternDetail)
async def get_pattern_detail(pattern_id: str):
    """形态教学详情（定义、回测数据）"""
    detector = get(pattern_id)
    if detector is None:
        raise NotFoundError(detail=f"未知形态: {pattern_id}")

    bt_data = _BACKTEST_DATA.get(pattern_id, {})
    f20 = bt_data.get("forward_20d", {})
    stats = PatternStats(
        forward_5d=BacktestWindow(**bt_data.get("forward_5d", {"win_rate": None, "avg_return": None, "occurrences": 0})),
        forward_10d=BacktestWindow(**bt_data.get("forward_10d", {"win_rate": None, "avg_return": None, "occurrences": 0})),
        forward_20d=BacktestWindow(**f20),
        win_rate_bull=bt_data.get("win_rate_bull"),
        win_rate_bear=bt_data.get("win_rate_bear"),
        win_rate_shock=bt_data.get("win_rate_shock"),
        sample_period=bt_data.get("sample_period", "2019-2026"),
        max_return=bt_data.get("max_return"),
        max_loss=bt_data.get("max_loss"),
        distribution=_build_distribution(bt_data.get("distribution")),
        regime_splits=_build_regime_splits(bt_data.get("regime_splits")),
        confidence_grade=_compute_confidence(f20.get("win_rate"), f20.get("occurrences", 0)),
        random_baseline=_build_random_baseline(bt_data.get("random_baseline")),
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
    detector = get(pattern_id)
    if detector is None:
        raise NotFoundError(detail=f"未知形态: {pattern_id}")

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


def _compute_confidence(win_rate: float | None, occurrences: int) -> str | None:
    """基于胜率和样本量计算信心等级"""
    if win_rate is None or occurrences < 100:
        return None
    if win_rate >= 0.65 and occurrences >= 500:
        return "A"
    elif win_rate >= 0.55 and occurrences >= 200:
        return "B"
    return "C"


def _build_distribution(raw: dict | None) -> list[DistributionBin] | None:
    """将回测输出的分布数据转为 DistributionBin 列表"""
    if not raw or "bins" not in raw or "counts" not in raw:
        return None
    bins = raw["bins"]
    counts = raw["counts"]
    if len(bins) < 2 or len(counts) != len(bins) - 1:
        return None
    return [
        DistributionBin(bin_start=bins[i], bin_end=bins[i + 1], count=counts[i])
        for i in range(len(counts))
    ]


def _build_regime_splits(raw: dict | None) -> list[RegimeSplit] | None:
    """将回测输出的牛熊拆分转为 RegimeSplit 列表"""
    if not raw:
        return None
    labels = {"bull": "牛市", "bear": "熊市", "shock": "震荡市"}
    result = []
    for regime_key in ["bull", "shock", "bear"]:
        data = raw.get(regime_key, {})
        if data.get("occurrences", 0) > 0:
            result.append(RegimeSplit(
                regime=regime_key,
                label=labels.get(regime_key, regime_key),
                win_rate=data.get("win_rate"),
                avg_return=data.get("avg_return"),
                occurrences=data.get("occurrences", 0),
            ))
    return result if result else None


def _build_random_baseline(raw: dict | None) -> RandomBaseline | None:
    """将回测输出的随机基线数据转为 RandomBaseline"""
    if not raw:
        return None
    return RandomBaseline(
        win_rate=raw.get("win_rate"),
        avg_return=raw.get("avg_return"),
        occurrences=raw.get("occurrences", 0),
    )


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
        "hammer": "近5日收盘整体走低（下跌趋势），今日下影线长度 ≥ 实体 2 倍，上影线 ≤ 实体 0.3 倍，且收盘价位于全日上半区。长下影线表明空方曾大幅打压但被多方收回，是潜在底部反转信号。",
        "inverted-hammer": "近5日收盘整体走低（下跌趋势），今日上影线长度 ≥ 实体 2 倍，下影线 ≤ 实体 0.3 倍。长上影线表明多方尝试上攻但遇阻，若次日收阳则确认反转。",
        "bullish-engulfing": "昨日为阴线（收 < 开），今日为阳线（收 > 开），且今日开 ≤ 昨收、今日收 ≥ 昨开，即今日阳线实体完全吞没昨日阴线实体。多方力量压倒空方，是看涨反转信号。",
        "bearish-engulfing": "昨日为阳线（收 > 开），今日为阴线（收 < 开），且今日开 ≥ 昨收、今日收 ≤ 昨开，即今日阴线实体完全吞没昨日阳线实体。空方力量压倒多方，是看跌反转信号。",
        "doji": "今日实体（|收-开|）占全日振幅（高-低）的比例 < 10%，即开盘价与收盘价几乎相同。十字星表示多空力量暂时均衡，可能预示当前趋势即将反转。",
        "shooting-star": "近5日收盘整体走高（上涨趋势），今日上影线长度 ≥ 实体 2 倍，下影线 ≤ 实体 0.3 倍，且收盘价位于全日下半区。长上影线表明多方上攻失败、空方反击，是潜在顶部反转信号。",
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
        "hammer": ["inverted-hammer", "doji", "bullish-engulfing"],
        "inverted-hammer": ["hammer", "doji", "shooting-star"],
        "bullish-engulfing": ["bearish-engulfing", "hammer", "volume-up-price-up"],
        "bearish-engulfing": ["bullish-engulfing", "shooting-star", "volume-up-price-down"],
        "doji": ["hammer", "shooting-star", "inverted-hammer"],
        "shooting-star": ["inverted-hammer", "doji", "bearish-engulfing"],
    }
    return related.get(pattern_id, [])
