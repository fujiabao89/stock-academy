"""合成历史数据生成器 — 为 30 只股票生成 10 年仿真日线，用于本地开发和回测验证

生成策略：
- 每只股票经历多轮牛/熊/震荡周期，自然形成多种技术形态
- 均值回归 + 趋势漂移 + 波动率聚类模拟真实价格行为
- 成交量与价格波动正相关，偶发放量
"""

import asyncio
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.engine import list_all
from app.engine.detectors import candlestick, golden_cross, ma_alignment, volume_price  # noqa: F401 — 触发注册
from app.models.daily_bar import DailyBar
from app.models.pattern_signal import PatternSignal

HS300_SAMPLE = [
    ("000001", "平安银行"), ("000002", "万科A"), ("000333", "美的集团"),
    ("000568", "泸州老窖"), ("000651", "格力电器"), ("000858", "五粮液"),
    ("002142", "宁波银行"), ("002415", "海康威视"), ("002594", "比亚迪"),
    ("300750", "宁德时代"), ("600000", "浦发银行"), ("600009", "上海机场"),
    ("600028", "中国石化"), ("600030", "中信证券"), ("600036", "招商银行"),
    ("600048", "保利发展"), ("600276", "恒瑞医药"), ("600309", "万华化学"),
    ("600519", "贵州茅台"), ("600585", "海螺水泥"), ("600809", "山西汾酒"),
    ("600887", "伊利股份"), ("600900", "长江电力"), ("601012", "隆基绿能"),
    ("601088", "中国神华"), ("601166", "兴业银行"), ("601318", "中国平安"),
    ("601398", "工商银行"), ("601668", "中国建筑"), ("601888", "中国中免"),
]

N_DAYS = 2500
START_DATE = date(2016, 1, 4)
SEED = 42


def build_regime_schedule(rng, n_days: int) -> list[int]:
    """为一只股票生成牛/熊/震荡周期序列，每个周期 80-250 天"""
    regimes = []
    remaining = n_days
    # 三类市场环境的比例：牛市 40%，熊市 25%，震荡 35%
    choices = [1, 1, 1, 1, -1, -1, 0, 0, 0]
    while remaining > 0:
        max_len = min(251, remaining); length = rng.integers(80, max_len + 1) if max_len >= 80 else remaining
        regime = rng.choice(choices)
        regimes.extend([regime] * length)
        remaining -= length
    return regimes[:n_days]


def generate_stock_data(rng, initial_price: float, base_volume: int, n_days: int):
    """为单只股票生成完整 OHLCV 序列

    返回: (closes, opens, highs, lows, volumes) 各为 float/int 列表
    """
    regimes = build_regime_schedule(rng, n_days)

    closes = [initial_price]
    for i in range(n_days - 1):
        prev = closes[-1]
        regime = regimes[i]

        # 漂移率：牛市 +15%/年，熊市 -10%/年，震荡 ±2%/年
        if regime == 1:
            annual_return = rng.uniform(0.05, 0.30)
        elif regime == -1:
            annual_return = rng.uniform(-0.25, -0.05)
        else:
            annual_return = rng.uniform(-0.05, 0.05)

        daily_drift = annual_return / 252
        # 波动率聚类：在趋势转换期波动加大
        if i > 0 and regimes[i] != regimes[i - 1]:
            vol = rng.uniform(0.015, 0.035)
        else:
            vol = rng.uniform(0.008, 0.022)

        ret = rng.normal(daily_drift, vol)
        price = max(prev * (1 + ret), 0.50)
        closes.append(price)

    # 构造 OHLC
    opens = []
    highs = []
    lows = []
    for i, c in enumerate(closes):
        if i == 0:
            opens.append(c * 0.995)
        else:
            # 开盘价在昨收附近随机波动
            gap = rng.normal(0, 0.005)
            opens.append(closes[i - 1] * (1 + gap))

        # 日内振幅
        amplitude = rng.uniform(0.005, 0.03)
        # 与隔夜涨跌同向概率 60%
        if rng.random() < 0.6:
            if c >= opens[i]:
                highs.append(c * (1 + amplitude * 0.3))
                lows.append(opens[i] * (1 - amplitude * 1.3))
            else:
                highs.append(opens[i] * (1 + amplitude * 0.3))
                lows.append(c * (1 - amplitude * 1.3))
        else:
            high = max(c, opens[i]) * (1 + amplitude * 0.5)
            low = min(c, opens[i]) * (1 - amplitude * 0.5)
            highs.append(high)
            lows.append(low)

    # 成交量：与价格波动正相关，偶发放量
    volumes = []
    for i, c in enumerate(closes):
        if i == 0:
            vol = base_volume
        else:
            ret = abs(c / closes[i - 1] - 1)
            # 波动大则量增，偶发 2-5x 放量
            expected = int(base_volume * (1 + ret * 50))
            if rng.random() < 0.03:  # 3% 概率放量
                expected *= rng.uniform(2.0, 5.0)
            vol = max(int(rng.normal(expected, expected * 0.3)), base_volume // 10)
        volumes.append(vol)

    return closes, opens, highs, lows, volumes


def compute_mas(closes: list[float]) -> tuple[list, list, list, list]:
    """计算 MA5/MA20/MA60/MA120"""
    n = len(closes)
    ma5 = [round(float(np.mean(closes[max(0, i - 4):i + 1])), 3) if i >= 4 else None for i in range(n)]
    ma20 = [round(float(np.mean(closes[max(0, i - 19):i + 1])), 3) if i >= 19 else None for i in range(n)]
    ma60 = [round(float(np.mean(closes[max(0, i - 59):i + 1])), 3) if i >= 59 else None for i in range(n)]
    ma120 = [round(float(np.mean(closes[max(0, i - 119):i + 1])), 3) if i >= 119 else None for i in range(n)]
    return ma5, ma20, ma60, ma120


async def clear_existing(db: AsyncSession):
    """清空已有数据"""
    await db.execute(text("DELETE FROM pattern_signals"))
    await db.execute(text("DELETE FROM daily_bars"))
    await db.commit()


# 回测数据（与 patterns.py _BACKTEST_DATA 保持一致）
_BACKTEST_DATA: dict[str, dict] = {
    "ma-bullish-alignment": {"forward_20d": {"win_rate": 0.734, "avg_return": 0.056, "occurrences": 1288}},
    "volume-up-price-up": {"forward_20d": {"win_rate": 0.716, "avg_return": 0.051, "occurrences": 1956}},
    "volume-price-divergence": {"forward_20d": {"win_rate": 0.730, "avg_return": 0.048, "occurrences": 734}},
    "ma-convergence-breakout": {"forward_20d": {"win_rate": 0.650, "avg_return": 0.043, "occurrences": 478}},
    "golden-cross": {"forward_20d": {"win_rate": 0.673, "avg_return": 0.044, "occurrences": 1034}},
    "death-cross": {"forward_20d": {"win_rate": None, "avg_return": None, "occurrences": 0}},
    "ma-bearish-alignment": {"forward_20d": {"win_rate": None, "avg_return": None, "occurrences": 0}},
    "volume-up-price-down": {"forward_20d": {"win_rate": None, "avg_return": None, "occurrences": 0}},
    "hammer": {"forward_20d": {"win_rate": 0.620, "avg_return": 0.0663, "occurrences": 292}},
    "inverted-hammer": {"forward_20d": {"win_rate": 0.644, "avg_return": 0.0762, "occurrences": 464}},
    "bullish-engulfing": {"forward_20d": {"win_rate": 0.648, "avg_return": 0.0716, "occurrences": 2521}},
    "bearish-engulfing": {"forward_20d": {"win_rate": 0.670, "avg_return": 0.0597, "occurrences": 2142}},
    "doji": {"forward_20d": {"win_rate": 0.663, "avg_return": 0.0764, "occurrences": 4697}},
    "shooting-star": {"forward_20d": {"win_rate": 0.681, "avg_return": 0.0622, "occurrences": 423}},
}

_DETERMINATIONS: dict[str, str] = {
    "ma-bullish-alignment": "MA5 > MA20 > MA60 > MA120，且四条均线均在昨日基础上继续向上倾斜，表明股价处于强势上升趋势中，多条均线形成多层支撑。",
    "ma-bearish-alignment": "MA5 < MA20 < MA60 < MA120，且四条均线均在昨日基础上继续向下倾斜，表明股价处于弱势下跌趋势中，多条均线形成层层压力。",
    "golden-cross": "短期均线 MA5 从下方上穿长期均线 MA20，形成金叉。通常被视为短期趋势转强的买入参考信号，但在震荡市中可能出现虚假信号。",
    "death-cross": "短期均线 MA5 从上方下穿长期均线 MA20，形成死叉。通常被视为短期趋势转弱的卖出参考信号，需结合成交量和其他指标综合判断。",
    "volume-up-price-up": "当日涨幅超过1%，同时成交量放大至20日均量的1.5倍以上。量价配合良好，表明上涨有资金推动，持续性相对较强。",
    "volume-up-price-down": "当日跌幅超过1%，同时成交量放大至20日均量的1.5倍以上。放量下跌表明抛压较重，需警惕进一步下行风险。",
    "ma-convergence-breakout": "过去20个交易日 MA5/MA20/MA60 三条均线紧密粘合（间距均小于5%），今日 MA5 向上突破。均线粘合后的方向选择往往预示着一段趋势行情的开始。",
    "volume-price-divergence": "股价创20日新高，但成交量反而萎缩至20日均量的80%以下。量价背离表明上涨动力不足，新高可能难以持续，需警惕回调风险。",
    "hammer": "近5日收盘整体走低（下跌趋势），今日下影线长度 ≥ 实体 2 倍，上影线 ≤ 实体 0.3 倍，且收盘价位于全日上半区。长下影线表明空方曾大幅打压但被多方收回，是潜在底部反转信号。",
    "inverted-hammer": "近5日收盘整体走低（下跌趋势），今日上影线长度 ≥ 实体 2 倍，下影线 ≤ 实体 0.3 倍。长上影线表明多方尝试上攻但遇阻，若次日收阳则确认反转。",
    "bullish-engulfing": "昨日为阴线（收 < 开），今日为阳线（收 > 开），且今日开 ≤ 昨收、今日收 ≥ 昨开，即今日阳线实体完全吞没昨日阴线实体。多方力量压倒空方，是看涨反转信号。",
    "bearish-engulfing": "昨日为阳线（收 > 开），今日为阴线（收 < 开），且今日开 ≥ 昨收、今日收 ≤ 昨开，即今日阴线实体完全吞没昨日阳线实体。空方力量压倒多方，是看跌反转信号。",
    "doji": "今日实体（|收-开|）占全日振幅（高-低）的比例 < 10%，即开盘价与收盘价几乎相同。十字星表示多空力量暂时均衡，可能预示当前趋势即将反转。",
    "shooting-star": "近5日收盘整体走高（上涨趋势），今日上影线长度 ≥ 实体 2 倍，下影线 ≤ 实体 0.3 倍，且收盘价位于全日下半区。长上影线表明多方上攻失败、空方反击，是潜在顶部反转信号。",
}

_RELATED: dict[str, list[str]] = {
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


async def main():
    rng = np.random.default_rng(SEED)
    np.random.seed(SEED)

    print("=== 合成历史数据生成 ===\n")
    print(f"股票数: {len(HS300_SAMPLE)} 只")
    print(f"每只: {N_DAYS} 个交易日")
    print(f"日期范围: {START_DATE} ~ {START_DATE + timedelta(days=N_DAYS - 1)}\n")

    async with async_session() as db:
        print("[1] 清空已有数据...")
        await clear_existing(db)

        total = 0
        total_signals = 0
        for code, name in HS300_SAMPLE:
            # 各股票赋予不同的初始价格和基础成交量
            initial_price = rng.uniform(5.0, 50.0)
            base_volume = rng.integers(50000, 500000)

            closes, opens, highs, lows, volumes = generate_stock_data(
                rng, initial_price, base_volume, N_DAYS
            )
            ma5, ma20, ma60, ma120 = compute_mas(closes)

            # 批量插入：每次 500 条
            batch = []
            for i in range(N_DAYS):
                bar = DailyBar(
                    code=code,
                    date=START_DATE + timedelta(days=i),
                    open=round(opens[i], 3),
                    high=round(highs[i], 3),
                    low=round(lows[i], 3),
                    close=round(closes[i], 3),
                    volume=volumes[i],
                    amount=round(closes[i] * volumes[i], 2),
                    ma5=ma5[i],
                    ma20=ma20[i],
                    ma60=ma60[i],
                    ma120=ma120[i],
                )
                batch.append(bar)

                if len(batch) >= 500:
                    db.add_all(batch)
                    await db.commit()
                    total += len(batch)
                    batch = []

            if batch:
                db.add_all(batch)
                await db.commit()
                total += len(batch)

            # 构建完整 bar 列表（用于形态检测）
            all_bars = []
            for i in range(N_DAYS):
                all_bars.append(DailyBar(
                    code=code,
                    date=START_DATE + timedelta(days=i),
                    open=round(opens[i], 3),
                    high=round(highs[i], 3),
                    low=round(lows[i], 3),
                    close=round(closes[i], 3),
                    volume=volumes[i],
                    amount=round(closes[i] * volumes[i], 2),
                    ma5=ma5[i],
                    ma20=ma20[i],
                    ma60=ma60[i],
                    ma120=ma120[i],
                ))

            # 运行形态检测并保存信号
            signal_counts: dict[str, int] = {}
            signals_to_insert: list[PatternSignal] = []
            for pid, detector in list_all().items():
                count = 0
                for i in range(120, len(all_bars)):
                    if detector.match(all_bars[:i + 1]):
                        count += 1
                        bt = _BACKTEST_DATA.get(pid, {})
                        signals_to_insert.append(PatternSignal(
                            code=code,
                            date=all_bars[i].date,
                            pattern_id=pid,
                            pattern_name=detector.pattern_name,
                            category=detector.category,
                            direction=detector.direction,
                            confidence=1.0,
                            description=_DETERMINATIONS.get(pid, detector.describe()),
                            backtest=bt.get("forward_20d", {}),
                            limitations=detector.limitations(),
                            related_patterns=_RELATED.get(pid, []),
                        ))
                signal_counts[pid] = count

            # 批量插入信号
            if signals_to_insert:
                for j in range(0, len(signals_to_insert), 500):
                    db.add_all(signals_to_insert[j:j + 500])
                    await db.commit()
                total_signals += len(signals_to_insert)

            signal_summary = ", ".join(f"{k}={v}" for k, v in signal_counts.items() if v > 0)
            print(f"  {code} {name}: 插入{N_DAYS}条 | 起始价{closes[0]:.2f} 最新价{closes[-1]:.2f} | 信号: {signal_summary}")

    print(f"\n[2] 总计插入 {total} 条日线数据, {total_signals} 条形态信号")
    print("完成！")


if __name__ == "__main__":
    asyncio.run(main())
