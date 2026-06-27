"""因子回测引擎 — 异步任务 + 条件评估 + 统计汇总"""

import asyncio
import random
from datetime import date, datetime, timezone
from collections import defaultdict

import numpy as np
from sqlalchemy import select, text

from ..database import async_session
from ..logging import get_logger
from ..models.daily_bar import DailyBar
from ..models.pattern_signal import PatternSignal
from ..models.strategy import StrategyBacktest
from ..services.strategy_engine import StrategyEngine

logger = get_logger(__name__)

MAX_CONCURRENT_TASKS = 3
FORWARD_WINDOWS = [5, 10, 20]
STOCKS_PER_BATCH = 500


async def submit_backtest(
    conditions: list[dict],
    forward_days: int = 20,
    strategy_id: int | None = None,
) -> int:
    """提交回测任务，返回 task_id"""
    async with async_session() as db:
        task = StrategyBacktest(
            strategy_id=strategy_id,
            conditions=conditions,
            forward_days=forward_days,
            status="pending",
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)
        task_id = task.id

    # 启动后台任务
    asyncio.create_task(_run_backtest(task_id))

    return task_id


async def get_backtest_status(task_id: int) -> dict:
    """查询回测任务状态"""
    async with async_session() as db:
        task = await db.get(StrategyBacktest, task_id)
        if task is None:
            return None

        return {
            "id": task.id,
            "status": task.status,
            "forward_days": task.forward_days,
            "result": task.result,
            "error_message": task.error_message,
            "created_at": task.created_at.isoformat() if task.created_at else None,
        }


async def _run_backtest(task_id: int):
    """后台执行回测"""
    async with async_session() as db:
        task = await db.get(StrategyBacktest, task_id)
        if task is None:
            return

        task.status = "running"
        await db.commit()

    try:
        result = await _execute_backtest(task.conditions, task.forward_days)

        async with async_session() as db:
            task = await db.get(StrategyBacktest, task_id)
            if task:
                task.status = "done"
                task.result = result
                await db.commit()

    except Exception as e:
        logger.error("backtest_failed", task_id=task_id, error=str(e)[:300])
        async with async_session() as db:
            task = await db.get(StrategyBacktest, task_id)
            if task:
                task.status = "error"
                task.error_message = str(e)[:500]
                await db.commit()


async def _execute_backtest(conditions: list[dict], forward_days: int) -> dict:
    """执行条件回测 — 遍历全市场股票"""
    end_date = date.today()
    start_date = end_date.replace(year=end_date.year - 3)

    results = {
        f"forward_{w}d": {
            "returns": [], "wins": 0, "occurrences": 0,
            "returns_bull": [], "returns_bear": [], "returns_shock": [],
        }
        for w in FORWARD_WINDOWS
    }

    async with async_session() as db:
        engine = StrategyEngine(db)

        # 单股预检：验证条件合法性
        codes_result = await db.execute(
            select(DailyBar.code).distinct().order_by(DailyBar.code).limit(1)
        )
        test_code = codes_result.scalar_one_or_none()
        if test_code:
            bars = await engine._load_bars(test_code)
            if len(bars) >= 2:
                try:
                    for cond_dict in conditions:
                        from ..services.strategy_engine import _Condition
                        cond = _Condition(**cond_dict)
                        await engine._check_condition(bars, test_code, cond)
                except Exception as e:
                    raise ValueError(f"条件校验失败: {e}") from e

        # 获取所有股票
        codes_result = await db.execute(
            select(DailyBar.code).distinct().order_by(DailyBar.code)
        )
        codes = [r[0] for r in codes_result.fetchall()]

        # 加载指数环境
        index_regime = await _load_index_regime(db, start_date, end_date)

        total_matched = 0
        all_entries = []

        for idx, code in enumerate(codes):
            try:
                bars_result = await db.execute(
                    select(DailyBar)
                    .where(DailyBar.code == code)
                    .where(DailyBar.date >= start_date)
                    .where(DailyBar.date <= end_date)
                    .order_by(DailyBar.date.asc())
                )
                bars = list(bars_result.scalars().all())

                if len(bars) < 121:
                    continue

                max_fwd = max(FORWARD_WINDOWS)

                for i in range(120, len(bars)):
                    today = bars[i]

                    # 跳过涨跌停
                    if i > 0 and _is_limit_day(today, bars[i - 1].close):
                        continue

                    # 收集有效入场点
                    if i + max_fwd < len(bars):
                        all_entries.append((bars, i))

                    # 条件评估
                    try:
                        for cond_dict in conditions:
                            from ..services.strategy_engine import _Condition
                            cond = _Condition(**cond_dict)
                            if not await engine._check_condition(bars, code, cond):
                                break
                        else:
                            # 所有条件都通过
                            total_matched += 1
                            for w in FORWARD_WINDOWS:
                                if i + w >= len(bars):
                                    continue
                                future_bars = bars[i + 1:i + w + 1]
                                if not future_bars:
                                    continue
                                max_price = max(b.high for b in future_bars)
                                ret = (max_price - today.close) / today.close
                                key = f"forward_{w}d"
                                results[key]["returns"].append(ret)
                                if ret >= 0.03:
                                    results[key]["wins"] += 1
                                results[key]["occurrences"] += 1
                                regime = index_regime.get(today.date, "shock")
                                if regime == "bull":
                                    results[key]["returns_bull"].append(ret)
                                elif regime == "bear":
                                    results[key]["returns_bear"].append(ret)
                                else:
                                    results[key]["returns_shock"].append(ret)
                    except Exception:
                        continue

                # 每 500 只输出进度
                if (idx + 1) % STOCKS_PER_BATCH == 0:
                    logger.info("backtest_progress", done=idx + 1, total=len(codes), matched=total_matched)

            except Exception:
                continue

    # 汇总统计
    output = {
        "conditions": conditions,
        "total_matched": total_matched,
        "stocks_checked": len(codes),
        "windows": {},
    }

    for w in FORWARD_WINDOWS:
        key = f"forward_{w}d"
        data = results[key]
        n = data["occurrences"]
        if n > 0:
            output["windows"][key] = {
                "win_rate": round(sum(1 for r in data["returns"] if r >= 0.03) / n, 3),
                "avg_return": round(float(np.mean(data["returns"])), 4),
                "max_return": round(max(data["returns"]), 4),
                "max_loss": round(min(data["returns"]), 4),
                "occurrences": n,
                "regime_splits": {
                    "bull": _regime_stats(data["returns_bull"]),
                    "bear": _regime_stats(data["returns_bear"]),
                    "shock": _regime_stats(data["returns_shock"]),
                },
                "random_baseline": _random_baseline(all_entries, w, n),
            }
        else:
            output["windows"][key] = {
                "win_rate": None, "avg_return": None,
                "occurrences": 0,
            }

    return output


# ── 辅助函数 ──

def _is_limit_day(bar: DailyBar, prev_close: float) -> bool:
    if prev_close <= 0:
        return False
    change = abs(bar.close - prev_close) / prev_close
    limit = 0.20 if bar.code.startswith("3") or bar.code.startswith("688") else 0.10
    return change >= limit - 0.001


def _regime_stats(returns: list) -> dict:
    n = len(returns)
    if n == 0:
        return {"win_rate": None, "avg_return": None, "occurrences": 0}
    wins = sum(1 for r in returns if r >= 0.03)
    return {
        "win_rate": round(wins / n, 3),
        "avg_return": round(float(np.mean(returns)), 4),
        "occurrences": n,
    }


def _random_baseline(entries: list, forward_days: int, n_samples: int) -> dict:
    if n_samples < 10 or len(entries) < n_samples:
        n_samples = min(n_samples, len(entries))
    if n_samples < 10:
        return {"win_rate": None, "avg_return": None, "occurrences": 0}

    sampled = random.sample(entries, n_samples)
    returns = []
    for bars, i in sampled:
        future = bars[i + 1:i + 1 + forward_days]
        max_p = max(b.high for b in future)
        ret = (max_p - bars[i].close) / bars[i].close
        returns.append(ret)

    wins = sum(1 for r in returns if r >= 0.03)
    return {
        "win_rate": round(wins / len(returns), 3),
        "avg_return": round(float(np.mean(returns)), 4),
        "occurrences": len(returns),
    }


async def _load_index_regime(db, start_date, end_date) -> dict:
    """计算合成市场环境"""
    rows = (await db.execute(
        select(DailyBar.date, DailyBar.close)
        .where(DailyBar.date >= start_date, DailyBar.date <= end_date)
        .order_by(DailyBar.date.asc())
    )).fetchall()

    if not rows:
        return {}

    date_closes = defaultdict(list)
    for d, close in rows:
        date_closes[d].append(close)

    sorted_dates = sorted(date_closes.keys())
    composites = [sum(date_closes[d]) / len(date_closes[d]) for d in sorted_dates]

    regime_map = {}
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
