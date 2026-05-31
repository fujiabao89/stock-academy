"""金叉/死叉检测器"""

from collections.abc import Sequence

from ..base import PatternDetector
from ...models.daily_bar import DailyBar


class GoldenCross(PatternDetector):
    pattern_id = "golden-cross"
    pattern_name = "金叉"
    category = "均线"
    direction = "bullish"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        """MA5 上穿 MA20：前一日 MA5 <= MA20，今日 MA5 > MA20"""
        if len(bars) < 2:
            return False
        today = bars[-1]
        yesterday = bars[-2]

        if None in (today.ma5, today.ma20, yesterday.ma5, yesterday.ma20):
            return False

        return yesterday.ma5 <= yesterday.ma20 and today.ma5 > today.ma20

    def limitations(self) -> list[str]:
        return ["金叉是瞬时信号，仅在触发日有效", "震荡市中频繁出现假金叉，需结合趋势过滤"]


class DeathCross(PatternDetector):
    pattern_id = "death-cross"
    pattern_name = "死叉"
    category = "均线"
    direction = "bearish"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        """MA5 下穿 MA20：前一日 MA5 >= MA20，今日 MA5 < MA20"""
        if len(bars) < 2:
            return False
        today = bars[-1]
        yesterday = bars[-2]

        if None in (today.ma5, today.ma20, yesterday.ma5, yesterday.ma20):
            return False

        return yesterday.ma5 >= yesterday.ma20 and today.ma5 < today.ma20

    def limitations(self) -> list[str]:
        return ["死叉是瞬时信号，仅在触发日有效", "震荡市中频繁出现假死叉"]


from ..registry import register
register(GoldenCross())
register(DeathCross())
