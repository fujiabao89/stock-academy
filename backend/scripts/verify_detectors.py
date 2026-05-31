"""形态检测器验证脚本 — 用合成数据验证 3 种优先形态的判定逻辑

不需要真实历史数据，生成可控的合成数据来验证检测器正负样本判定。
"""

import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np

from app.engine.detectors.golden_cross import DeathCross, GoldenCross
from app.engine.detectors.ma_alignment import MABearishAlignment, MABullishAlignment
from app.engine.detectors.volume_price import VolumeUpPriceUp
from app.models.daily_bar import DailyBar


def make_bars(
    closes: list[float],
    volumes: list[int] | None = None,
    highs: list[float] | None = None,
    lows: list[float] | None = None,
    start_date: date = date(2025, 1, 1),
) -> list[DailyBar]:
    """从价格序列构造 DailyBar 列表，自动计算均线"""
    n = len(closes)
    if volumes is None:
        volumes = [100000] * n
    if highs is None:
        highs = [c * 1.01 for c in closes]
    if lows is None:
        lows = [c * 0.99 for c in closes]

    bars = []
    for i in range(n):
        bar = DailyBar(
            code="000001",
            date=start_date + timedelta(days=i),
            open=closes[i] * 0.99,
            high=highs[i],
            low=lows[i],
            close=closes[i],
            volume=volumes[i],
            amount=closes[i] * volumes[i],
        )
        # 计算均线
        if i >= 4:
            bar.ma5 = round(np.mean(closes[i - 4 : i + 1]), 3)
        if i >= 19:
            bar.ma20 = round(np.mean(closes[i - 19 : i + 1]), 3)
        if i >= 59:
            bar.ma60 = round(np.mean(closes[i - 59 : i + 1]), 3)
        if i >= 119:
            bar.ma120 = round(np.mean(closes[i - 119 : i + 1]), 3)
        bars.append(bar)
    return bars


def make_uptrend(n_days: int = 140) -> list[float]:
    """生成上升趋势价格序列"""
    base = np.linspace(10, 20, n_days)
    noise = np.random.normal(0, 0.15, n_days)
    return (base + noise).tolist()


def make_downtrend(n_days: int = 140) -> list[float]:
    """生成下降趋势价格序列"""
    base = np.linspace(20, 10, n_days)
    noise = np.random.normal(0, 0.15, n_days)
    return (base + noise).tolist()


def make_sideways(n_days: int = 140) -> list[float]:
    """生成震荡趋势价格序列"""
    base = np.full(n_days, 15.0)
    noise = np.random.normal(0, 0.3, n_days)
    return (base + noise).tolist()


# ============================================================
# 测试 1: 均线多头排列
# ============================================================
def test_ma_bullish_alignment():
    print("=== 测试: 均线多头排列 ===")

    # 场景 A: 持续上升趋势 → 应该触发多头排列
    closes_a = make_uptrend(140)
    bars_a = make_bars(closes_a)
    detector = MABullishAlignment()
    result_a = detector.match(bars_a)
    print(f"  上升趋势 (140天): {'触发' if result_a else '未触发'} — 预期: 触发")

    # 场景 B: 持续下降趋势 → 不应触发多头排列
    closes_b = make_downtrend(140)
    bars_b = make_bars(closes_b)
    result_b = detector.match(bars_b)
    print(f"  下降趋势 (140天): {'触发' if result_b else '未触发'} — 预期: 未触发")

    # 场景 C: 震荡市 → 均线纠缠，不应触发
    closes_c = make_sideways(140)
    bars_c = make_bars(closes_c)
    result_c = detector.match(bars_c)
    print(f"  震荡趋势 (140天): {'触发' if result_c else '未触发'} — 预期: 未触发")

    return result_a and not result_b and not result_c


# ============================================================
# 测试 2: 金叉
# ============================================================
def test_golden_cross():
    print("\n=== 测试: 金叉 (MA5 上穿 MA20) ===")

    # 场景 A: MA5 从下方上穿 MA20
    # 构造：前 20 天 MA5 < MA20（下跌→企稳），然后价格反弹使 MA5 > MA20
    closes_a = [20 - i * 0.3 for i in range(20)]  # 下跌：20 → 14.3
    closes_a += [14.5] * 5  # 企稳
    closes_a += [14.5 + i * 0.8 for i in range(10)]  # 快速反弹
    closes_a += [23.0] * 90  # 维持高位
    bars_a = make_bars(closes_a)
    gc = GoldenCross()
    dc = DeathCross()

    # 找到触发点
    triggered = False
    for i in range(20, len(bars_a)):
        if gc.match(bars_a[: i + 1]):
            print(f"  金叉触发于 第{i}天 (close={closes_a[i]:.2f}, MA5={bars_a[i].ma5:.2f}, MA20={bars_a[i].ma20:.2f})")
            triggered = True
            break
    if not triggered:
        print("  未触发金叉 — 可能价格路径不够陡峭")
    print(f"  金叉检测: {'通过' if triggered else '需调整参数'}")

    # 场景 B: 死叉 — MA5 从上方下穿 MA20
    closes_b = [10 + i * 0.3 for i in range(20)]  # 上涨
    closes_b += [16.0] * 5  # 横盘
    closes_b += [16.0 - i * 0.8 for i in range(10)]  # 快速下跌
    closes_b += [7.0] * 90
    bars_b = make_bars(closes_b)
    death_triggered = False
    for i in range(20, len(bars_b)):
        if dc.match(bars_b[: i + 1]):
            print(f"  死叉触发于 第{i}天 (close={closes_b[i]:.2f})")
            death_triggered = True
            break
    print(f"  死叉检测: {'通过' if death_triggered else '需调整参数'}")

    return triggered and death_triggered


# ============================================================
# 测试 3: 放量上涨
# ============================================================
def test_volume_up_price_up():
    print("\n=== 测试: 放量上涨 ===")

    # 场景 A: 量比 > 1.5 且涨幅 > 1%
    closes = [10.0] * 21
    closes[-1] = 10.3  # 涨 3%
    volumes = [100000] * 21
    volumes[-1] = 3000000  # 量比 = 30x
    highs = [c * 1.02 for c in closes]
    highs[-1] = 10.35
    lows = [c * 0.98 for c in closes]
    bars_a = make_bars(closes, volumes, highs, lows)
    detector = VolumeUpPriceUp()
    result_a = detector.match(bars_a)
    print(f"  大成交量+大涨: {'触发' if result_a else '未触发'} — 预期: 触发")

    # 场景 B: 涨幅不够（< 1%）
    closes[-1] = 10.05  # 只涨 0.5%
    bars_b = make_bars(closes, volumes)
    result_b = detector.match(bars_b)
    print(f"  大成交量+小涨: {'触发' if result_b else '未触发'} — 预期: 未触发")

    # 场景 C: 成交量不够（量比 < 1.5）
    volumes[-1] = 120000  # 量比 = 1.2x
    closes[-1] = 10.3  # 涨 3%
    bars_c = make_bars(closes, volumes, highs, lows)
    result_c = detector.match(bars_c)
    print(f"  小成交量+大涨: {'触发' if result_c else '未触发'} — 预期: 未触发")

    return result_a and not result_b and not result_c


if __name__ == "__main__":
    print("炒股学堂 — 形态检测器验证\n")
    np.random.seed(42)

    r1 = test_ma_bullish_alignment()
    r2 = test_golden_cross()
    r3 = test_volume_up_price_up()

    print(f"\n{'='*50}")
    all_pass = r1 and r2 and r3
    print(f"结果: {'全部通过' if all_pass else '部分失败'}")
    print(f"  均线多头排列: {'OK' if r1 else 'FAIL'}")
    print(f"  金叉/死叉:     {'OK' if r2 else 'FAIL'}")
    print(f"  放量上涨:      {'OK' if r3 else 'FAIL'}")
