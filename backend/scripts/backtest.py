"""形态回测脚本

对指定形态在历史数据上运行回测，计算各前向窗口的 win_rate / avg_return。

使用方式：
    python scripts/backtest.py --pattern golden-cross
    python scripts/backtest.py --all
    python scripts/backtest.py --pattern golden-cross --start 2015-01-01 --end 2025-12-31
"""

import argparse
import asyncio
import json
import random
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.engine import get, list_all
from app.engine.detectors import (  # noqa: F401 — 触发注册
    golden_cross,
    ma_alignment,
    volume_price,
)
from app.models.daily_bar import DailyBar


def _is_limit_day(bar: DailyBar, prev_close: float) -> bool:
    """判断是否为涨跌停日（±10% 或 ±20% 创业板/科创板）"""
    if prev_close <= 0:
        return False
    change = abs(bar.close - prev_close) / prev_close
    limit = 0.20 if bar.code.startswith("3") or bar.code.startswith("688") else 0.10
    return change >= limit - 0.001


def _market_regime(ma60_direction: float | None) -> str:
    """根据 MA60 方向判断市场环境"""
    if ma60_direction is None:
        return "shock"
    if ma60_direction > 0:
        return "bull"
    elif ma60_direction < 0:
        return "bear"
    return "shock"


async def _load_index_regime(db, start_date, end_date) -> dict:
    """计算合成市场环境：等权平均所有股票收盘价，MA60 方向定牛熊

    返回 {date: "bull"|"bear"|"shock"} 字典
    """
    rows = (await db.execute(
        select(DailyBar.date, DailyBar.close)
        .where(DailyBar.date >= start_date, DailyBar.date <= end_date)
        .order_by(DailyBar.date.asc())
    )).fetchall()

    if not rows:
        return {}

    date_closes: dict = defaultdict(list)
    for d, close in rows:
        date_closes[d].append(close)

    sorted_dates = sorted(date_closes.keys())
    composites = [sum(date_closes[d]) / len(date_closes[d]) for d in sorted_dates]

    regime_map: dict = {}
    for i in range(60, len(sorted_dates)):
        ma60_today = sum(composites[i - 59:i + 1]) / 60
        ma60_yesterday = sum(composites[i - 60:i]) / 60
        if ma60_today > ma60_yesterday:
            regime_map[sorted_dates[i]] = "bull"
        elif ma60_today < ma60_yesterday:
            regime_map[sorted_dates[i]] = "bear"
        else:
            regime_map[sorted_dates[i]] = "shock"

    return regime_map


def _compute_distribution(returns: list, bins: int = 10) -> dict | None:
    """计算收益分布直方图数据"""
    if len(returns) < 2:
        return None
    counts, bin_edges = np.histogram(returns, bins=bins)
    return {
        "bins": [round(e, 4) for e in bin_edges.tolist()],
        "counts": counts.tolist(),
        "n": len(returns),
    }


def _regime_stats(returns: list) -> dict:
    """计算单组收益的胜率和均收益"""
    n = len(returns)
    if n == 0:
        return {"win_rate": None, "avg_return": None, "occurrences": 0}
    wins = sum(1 for r in returns if r >= 0.03)
    return {
        "win_rate": round(wins / n, 3),
        "avg_return": round(float(np.mean(returns)), 4),
        "occurrences": n,
    }


def _random_baseline(
    entries: list, forward_days: int, n_samples: int, direction: str
) -> dict:
    """随机入场采样，计算基线胜率。从所有有效入场点中随机抽取 n_samples 个。"""
    if len(entries) < n_samples:
        n_samples = len(entries)
    if n_samples < 10:
        return {"win_rate": None, "avg_return": None, "occurrences": 0}

    sampled = random.sample(entries, n_samples)
    returns: list[float] = []
    for bars, i in sampled:
        future = bars[i + 1 : i + 1 + forward_days]
        if direction == "bearish":
            min_p = min(b.low for b in future)
            ret = (bars[i].close - min_p) / bars[i].close
        else:
            max_p = max(b.high for b in future)
            ret = (max_p - bars[i].close) / bars[i].close
        returns.append(ret)

    wins = sum(1 for r in returns if r >= 0.03)
    return {
        "win_rate": round(wins / len(returns), 3),
        "avg_return": round(float(np.mean(returns)), 4),
        "occurrences": len(returns),
    }


async def backtest_pattern(
    pattern_id: str,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    """对单个形态执行回测"""
    detector = get(pattern_id)
    if detector is None:
        return {"error": f"未知形态: {pattern_id}"}

    if start_date is None:
        start_date = date.today() - timedelta(days=365 * 10)
    if end_date is None:
        end_date = date.today()

    forward_windows = [5, 10, 20]
    results = {
        f"forward_{w}d": {
            "wins": 0, "returns": [], "occurrences": 0,
            "returns_bull": [], "returns_bear": [], "returns_shock": [],
        }
        for w in forward_windows
    }

    async with async_session() as db:
        # 加载市场环境数据
        index_regime = await _load_index_regime(db, start_date, end_date)

        # 获取所有有数据的股票代码
        codes_result = await db.execute(
            select(DailyBar.code).distinct().order_by(DailyBar.code)
        )
        codes = [row[0] for row in codes_result.fetchall()]

        total_checked = 0
        total_matched = 0
        all_entries: list[tuple] = []  # (bars, i) — 随机基线采样池

        for code in codes:
            # 加载该股票的所有历史日线
            bars_result = await db.execute(
                select(DailyBar)
                .where(DailyBar.code == code)
                .where(DailyBar.date >= start_date)
                .where(DailyBar.date <= end_date)
                .order_by(DailyBar.date.asc())
            )
            bars = list(bars_result.scalars().all())

            if len(bars) < 121:  # 需要至少120天计算MA
                continue

            max_fwd = max(forward_windows)

            # 滑动窗口检测
            for i in range(120, len(bars)):
                window = bars[i - 120 : i + 1]
                today = window[-1]

                # 跳过涨跌停日
                prev = window[-2]
                if _is_limit_day(today, prev.close):
                    continue

                # 收集有效入场点（非涨跌停 + 有足够前向数据）
                if i + max_fwd < len(bars):
                    all_entries.append((bars, i))

                if detector.match(window):
                    total_matched += 1

                    # 计算各前向窗口的收益
                    for w in forward_windows:
                        if i + w >= len(bars):
                            continue
                        future_bars = bars[i + 1 : i + w + 1]
                        if not future_bars:
                            continue

                        if detector.direction == "bearish":
                            min_price = min(b.low for b in future_bars)
                            ret = (today.close - min_price) / today.close
                        else:
                            max_price = max(b.high for b in future_bars)
                            ret = (max_price - today.close) / today.close
                        results[f"forward_{w}d"]["returns"].append(ret)
                        if ret >= 0.03:
                            results[f"forward_{w}d"]["wins"] += 1
                        results[f"forward_{w}d"]["occurrences"] += 1
                        regime = index_regime.get(today.date, "shock")
                        if regime == "bull":
                            results[f"forward_{w}d"]["returns_bull"].append(ret)
                        elif regime == "bear":
                            results[f"forward_{w}d"]["returns_bear"].append(ret)
                        else:
                            results[f"forward_{w}d"]["returns_shock"].append(ret)

            total_checked += 1

    # 随机入场基线（从 all_entries 中采样，与形态信号同等数量）
    random_baselines: dict = {}
    for w in forward_windows:
        key = f"forward_{w}d"
        bl = _random_baseline(
            all_entries, w,
            n_samples=total_matched if total_matched > 0 else 100,
            direction=detector.direction,
        )
        random_baselines[key] = bl

    # 汇总统计
    output = {
        "pattern_id": pattern_id,
        "pattern_name": detector.pattern_name,
        "total_occurrences": total_matched,
        "stocks_checked": total_checked,
        "regime_dates_available": len(index_regime),
        "valid_entry_pool": len(all_entries),
    }
    for w in forward_windows:
        key = f"forward_{w}d"
        data = results[key]
        n = data["occurrences"]
        output[key] = {
            "win_rate": round(data["wins"] / n, 3) if n > 0 else None,
            "avg_return": round(float(np.mean(data["returns"])), 4) if n > 0 else None,
            "max_return": round(max(data["returns"]), 4) if n > 0 else None,
            "max_loss": round(min(data["returns"]), 4) if n > 0 else None,
            "occurrences": n,
            "distribution": _compute_distribution(data["returns"]),
            "regime_splits": {
                "bull": _regime_stats(data["returns_bull"]),
                "bear": _regime_stats(data["returns_bear"]),
                "shock": _regime_stats(data["returns_shock"]),
            },
            "random_baseline": random_baselines[key],
        }

    return output


async def main():
    parser = argparse.ArgumentParser(description="形态回测")
    parser.add_argument("--pattern", type=str, help="形态ID")
    parser.add_argument("--all", action="store_true", help="所有形态")
    parser.add_argument("--start", type=str, help="起始日期 YYYY-MM-DD")
    parser.add_argument("--end", type=str, help="结束日期 YYYY-MM-DD")
    parser.add_argument("--output-json", type=str, help="导出 JSON 文件路径")
    parser.add_argument("--seed", type=int, default=None, help="随机种子（固定后随机基线可复现）")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    start_date = date.fromisoformat(args.start) if args.start else None
    end_date = date.fromisoformat(args.end) if args.end else None

    if args.all:
        patterns = list(list_all().keys())
    elif args.pattern:
        patterns = [args.pattern]
    else:
        print("请指定 --pattern <id> 或 --all")
        sys.exit(1)

    all_results = []
    for pid in patterns:
        print(f"\n回测: {pid} ...")
        result = await backtest_pattern(pid, start_date, end_date)
        if "error" in result:
            print(f"  错误: {result['error']}")
            continue
        print(f"  形态: {result['pattern_name']}")
        print(f"  触发次数: {result['total_occurrences']}")
        print(f"  市场环境数据覆盖: {result.get('regime_dates_available', 0)} 个交易日")
        all_results.append(result)
        for w in [5, 10, 20]:
            data = result[f"forward_{w}d"]
            wr = data["win_rate"]
            ar = data["avg_return"]
            n = data["occurrences"]
            if wr is not None:
                dist = data.get("distribution")
                dist_info = f", 分布={dist['n']}样本/{len(dist['bins'])-1}桶" if dist else ""
                print(f"    {w}日窗口: 胜率={wr:.1%} 均收益={ar:.2%} (n={n}){dist_info}")
                regime = data.get("regime_splits", {})
                for label in ["bull", "shock", "bear"]:
                    rs = regime.get(label, {})
                    if rs.get("occurrences", 0) > 0:
                        print(f"      {label}: 胜率={rs['win_rate']:.1%} 均收益={rs['avg_return']:.2%} (n={rs['occurrences']})")
            else:
                print(f"    {w}日窗口: 样本不足 (n={n})")

    if args.output_json and all_results:
        out_path = Path(args.output_json)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(all_results, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        print(f"\nJSON 已导出: {out_path} ({len(all_results)} 个形态)")


if __name__ == "__main__":
    asyncio.run(main())
