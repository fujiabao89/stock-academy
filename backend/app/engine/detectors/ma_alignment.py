"""均线排列检测器：多头排列 + 空头排列"""

from collections.abc import Sequence

from ..base import PatternDetector
from ...models.daily_bar import DailyBar


class MABullishAlignment(PatternDetector):
    pattern_id = "ma-bullish-alignment"
    pattern_name = "均线多头排列"
    category = "均线"
    direction = "bullish"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        if len(bars) < 2:
            return False
        today = bars[-1]
        yesterday = bars[-2]

        # 确保前4根K线也有均线值以计算斜率方向
        if len(bars) < 5:
            return False

        # 条件1：MA5 > MA20 > MA60 > MA120
        ma_values = [today.ma5, today.ma20, today.ma60, today.ma120]
        if any(v is None for v in ma_values):
            return False
        if not (today.ma5 > today.ma20 > today.ma60 > today.ma120):
            return False

        # 条件2：四线均向上斜率（前一日均线 < 当日均线）
        ma_pairs = [
            (yesterday.ma5, today.ma5),
            (yesterday.ma20, today.ma20),
            (yesterday.ma60, today.ma60),
            (yesterday.ma120, today.ma120),
        ]
        if any(prev is None or curr is None or prev >= curr for prev, curr in ma_pairs):
            return False

        return True

    def limitations(self) -> list[str]:
        return ["均线排列为滞后指标，信号出现时价格可能已部分兑现", "震荡市中均线反复缠绕，排列信号失效概率较高"]


class MABearishAlignment(PatternDetector):
    pattern_id = "ma-bearish-alignment"
    pattern_name = "均线空头排列"
    category = "均线"
    direction = "bearish"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        if len(bars) < 2:
            return False
        today = bars[-1]
        yesterday = bars[-2]

        if len(bars) < 5:
            return False

        # 条件1：MA5 < MA20 < MA60 < MA120
        ma_values = [today.ma5, today.ma20, today.ma60, today.ma120]
        if any(v is None for v in ma_values):
            return False
        if not (today.ma5 < today.ma20 < today.ma60 < today.ma120):
            return False

        # 条件2：四线均向下斜率
        ma_pairs = [
            (yesterday.ma5, today.ma5),
            (yesterday.ma20, today.ma20),
            (yesterday.ma60, today.ma60),
            (yesterday.ma120, today.ma120),
        ]
        if any(prev is None or curr is None or prev <= curr for prev, curr in ma_pairs):
            return False

        return True

    def limitations(self) -> list[str]:
        return ["空头排列期间可能出现短暂反弹", "股价距均线过远时关注乖离率风险"]


from ..registry import register
register(MABullishAlignment())
register(MABearishAlignment())
