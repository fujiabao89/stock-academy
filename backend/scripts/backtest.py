"""形态回测脚本

对指定形态在历史数据上运行回测，计算各前向窗口的 win_rate / avg_return。

使用方式：
    python scripts/backtest.py --pattern golden-cross
    python scripts/backtest.py --all
    python scripts/backtest.py --pattern golden-cross --start 2015-01-01 --end 2025-12-31
"""

import argparse
import asyncio
import sys
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


def _market_regime(index_ma60_direction: int) -> str:
    """根据沪深300 60日均线方向判断市场环境"""
    if index_ma60_direction > 0:
        return "bull"
    elif index_ma60_direction < 0:
        return "bear"
    return "shock"


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
    results = {f"forward_{w}d": {"wins": 0, "returns": [], "occurrences": 0} for w in forward_windows}

    async with async_session() as db:
        # 获取所有有数据的股票代码
        codes_result = await db.execute(
            select(DailyBar.code).distinct().order_by(DailyBar.code)
        )
        codes = [row[0] for row in codes_result.fetchall()]

        total_checked = 0
        total_matched = 0

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

            # 滑动窗口检测
            for i in range(120, len(bars)):
                window = bars[i - 120 : i + 1]
                today = window[-1]

                # 跳过涨跌停日
                prev = window[-2]
                if _is_limit_day(today, prev.close):
                    continue

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

            total_checked += 1

    # 汇总统计
    output = {
        "pattern_id": pattern_id,
        "pattern_name": detector.pattern_name,
        "total_occurrences": total_matched,
        "stocks_checked": total_checked,
    }
    for w in forward_windows:
        key = f"forward_{w}d"
        data = results[key]
        n = data["occurrences"]
        output[key] = {
            "win_rate": round(data["wins"] / n, 3) if n > 0 else None,
            "avg_return": round(np.mean(data["returns"]), 4) if n > 0 else None,
            "max_return": round(max(data["returns"]), 4) if n > 0 else None,
            "max_loss": round(min(data["returns"]), 4) if n > 0 else None,
            "occurrences": n,
        }

    return output


async def main():
    parser = argparse.ArgumentParser(description="形态回测")
    parser.add_argument("--pattern", type=str, help="形态ID")
    parser.add_argument("--all", action="store_true", help="所有形态")
    parser.add_argument("--start", type=str, help="起始日期 YYYY-MM-DD")
    parser.add_argument("--end", type=str, help="结束日期 YYYY-MM-DD")
    args = parser.parse_args()

    start_date = date.fromisoformat(args.start) if args.start else None
    end_date = date.fromisoformat(args.end) if args.end else None

    if args.all:
        patterns = list(list_all().keys())
    elif args.pattern:
        patterns = [args.pattern]
    else:
        print("请指定 --pattern <id> 或 --all")
        sys.exit(1)

    for pid in patterns:
        print(f"\n回测: {pid} ...")
        result = await backtest_pattern(pid, start_date, end_date)
        if "error" in result:
            print(f"  错误: {result['error']}")
            continue
        print(f"  形态: {result['pattern_name']}")
        print(f"  触发次数: {result['total_occurrences']}")
        for w in [5, 10, 20]:
            data = result[f"forward_{w}d"]
            wr = data["win_rate"]
            ar = data["avg_return"]
            n = data["occurrences"]
            if wr is not None:
                print(f"    {w}日窗口: 胜率={wr:.1%} 均收益={ar:.2%} (n={n})")
            else:
                print(f"    {w}日窗口: 样本不足 (n={n})")


if __name__ == "__main__":
    asyncio.run(main())
