"""策略条件评估引擎 — 将条件组合与 K 线数据匹配"""

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.daily_bar import DailyBar
from ..models.pattern_signal import PatternSignal
from ..models.strategy import Strategy, StrategyRun
from ..stock_names import _STOCK_NAMES

_WINDOW = 120  # 加载最近 120 根日 K 线


@dataclass
class _Condition:
    field: str
    operator: str
    value: float | None = None
    field2: str | None = None
    pattern_id: str | None = None


class StrategyEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _load_bars(self, code: str) -> list[DailyBar]:
        rows = await self.db.execute(
            select(DailyBar)
            .where(DailyBar.code == code)
            .order_by(DailyBar.date.desc())
            .limit(_WINDOW)
        )
        bars = list(rows.scalars().all())
        bars.sort(key=lambda b: b.date)
        return bars

    # ── 基础值映射 ──

    def _bar_val(self, bar: DailyBar, field: str, bars: list[DailyBar]) -> float | None:
        _map: dict[str, float | None] = {
            "open": bar.open,
            "high": bar.high,
            "low": bar.low,
            "close": bar.close,
            "volume": bar.volume,
            "ma5": bar.ma5,
            "ma20": bar.ma20,
            "ma60": bar.ma60,
            "ma120": bar.ma120,
        }
        if field in _map:
            return _map[field]

        # 虚拟字段
        if field == "volume_ratio_20":
            avg = self._avg_volume(bars, 20)
            return bar.volume / avg if avg > 0 else None
        if field == "high_20":
            return self._n_day_high(bars, 20)
        if field == "price_range_20":
            return self._n_day_price_range(bars, 20)

        return None

    # ── 辅助计算 ──

    @staticmethod
    def _avg_volume(bars: list[DailyBar], n: int) -> float:
        if len(bars) < n:
            return 0.0
        vols = [b.volume for b in bars[-n:]]
        return sum(vols) / len(vols) if vols else 0.0

    @staticmethod
    def _n_day_high(bars: list[DailyBar], n: int) -> float:
        if len(bars) < n:
            return 0.0
        return max(b.high for b in bars[-n:])

    @staticmethod
    def _n_day_price_range(bars: list[DailyBar], n: int) -> float:
        """20 日平均日内振幅：(high - low) / close 的均值"""
        if len(bars) < n:
            return 0.0
        ranges = [(b.high - b.low) / b.close for b in bars[-n:] if b.close > 0]
        return sum(ranges) / len(ranges) if ranges else 0.0

    # ── 条件检查 ──

    async def _check_condition(
        self, bars: list[DailyBar], code: str, cond: _Condition
    ) -> bool:
        if len(bars) < 2:
            return False

        today = bars[-1]
        yesterday = bars[-2]

        # 形态条件
        if cond.field == "pattern":
            if not cond.pattern_id:
                return False
            row = await self.db.execute(
                select(PatternSignal.id).where(
                    PatternSignal.code == code,
                    PatternSignal.pattern_id == cond.pattern_id,
                    PatternSignal.date == today.date,
                )
            )
            return row.scalar_one_or_none() is not None

        # 数值/字段比较条件
        val = self._bar_val(today, cond.field, bars)
        if val is None:
            return False

        # 获取比较目标: value 阈值 或 field2 当前值
        target = cond.value
        if cond.field2 and target is None:
            target = self._bar_val(today, cond.field2, bars)
            if target is None:
                return False
        if target is None:
            return False

        if cond.operator == "gt":
            return val > target

        elif cond.operator == "lt":
            return val < target

        elif cond.operator == "eq":
            return val == target

        elif cond.operator in ("cross_above", "cross_below"):
            if not cond.field2:
                return False
            prev_val = self._bar_val(yesterday, cond.field, bars)
            prev_val2 = self._bar_val(yesterday, cond.field2, bars)
            cur_val2 = self._bar_val(today, cond.field2, bars)
            if None in (prev_val, prev_val2, cur_val2):
                return False
            if cond.operator == "cross_above":
                return prev_val <= prev_val2 and val > cur_val2
            else:
                return prev_val >= prev_val2 and val < cur_val2

        return False

    # ── 评估与扫描 ──

    async def evaluate(self, strategy: Strategy, code: str) -> tuple[bool, list[dict]]:
        bars = await self._load_bars(code)
        if len(bars) < 2:
            return False, []

        conditions = [_Condition(**c) for c in strategy.conditions]
        details: list[dict] = []

        for cond in conditions:
            ok = await self._check_condition(bars, code, cond)
            details.append({
                "field": cond.field,
                "operator": cond.operator,
                "value": cond.value,
                "field2": cond.field2,
                "pattern_id": cond.pattern_id,
                "matched": ok,
            })
            if not ok:
                return False, details

        return True, details

    async def scan(self, strategy: Strategy) -> tuple[int, int, list[StrategyRun]]:
        codes_row = await self.db.execute(
            select(distinct(DailyBar.code)).order_by(DailyBar.code)
        )
        codes = [r[0] for r in codes_row.fetchall()]

        now = datetime.now(timezone.utc)
        runs: list[StrategyRun] = []

        for code in codes:
            matched, details = await self.evaluate(strategy, code)
            if matched:
                info = _STOCK_NAMES.get(code)
                name = info[0] if info else code
                close = await self._last_close(code)
                runs.append(
                    StrategyRun(
                        strategy_id=strategy.id,
                        stock_code=code,
                        stock_name=name,
                        matched_at=now,
                        details={"conditions": details, "close": close},
                    )
                )

        # 清除旧结果
        from sqlalchemy import delete
        await self.db.execute(
            delete(StrategyRun).where(StrategyRun.strategy_id == strategy.id)
        )

        for r in runs:
            self.db.add(r)

        await self.db.commit()

        return len(codes), len(runs), runs

    async def _last_close(self, code: str) -> float | None:
        row = await self.db.execute(
            select(DailyBar.close)
            .where(DailyBar.code == code)
            .order_by(DailyBar.date.desc())
            .limit(1)
        )
        return row.scalar_one_or_none()
