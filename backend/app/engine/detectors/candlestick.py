"""K线蜡烛图形态检测器 — 6 种经典反转/持续形态"""

from collections.abc import Sequence

from ..base import PatternDetector
from ...models.daily_bar import DailyBar


def _body(bar: DailyBar) -> float:
    """实体长度"""
    return abs(bar.close - bar.open)


def _upper_shadow(bar: DailyBar) -> float:
    """上影线长度"""
    return bar.high - max(bar.open, bar.close)


def _lower_shadow(bar: DailyBar) -> float:
    """下影线长度"""
    return min(bar.open, bar.close) - bar.low


def _is_downtrend(bars: Sequence[DailyBar], lookback: int = 5) -> bool:
    """近 N 日收盘价整体走低"""
    if len(bars) < lookback + 1:
        return False
    recent = [b.close for b in bars[-lookback - 1:]]
    return sum(recent[i] - recent[i - 1] for i in range(1, len(recent))) < 0


def _is_uptrend(bars: Sequence[DailyBar], lookback: int = 5) -> bool:
    """近 N 日收盘价整体走高"""
    if len(bars) < lookback + 1:
        return False
    recent = [b.close for b in bars[-lookback - 1:]]
    return sum(recent[i] - recent[i - 1] for i in range(1, len(recent))) > 0


class Hammer(PatternDetector):
    """锤子线 — 下跌趋势末端出现，长下影线，看涨反转信号"""

    pattern_id = "hammer"
    pattern_name = "锤子线"
    category = "K线形态"
    direction = "bullish"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        if len(bars) < 6:
            return False
        bar = bars[-1]
        body = _body(bar)
        if body == 0:
            return False
        if bar.high == bar.low:
            return False

        return (
            _is_downtrend(bars)
            and _lower_shadow(bar) >= body * 2
            and _upper_shadow(bar) <= body * 0.3
            and (bar.close - bar.low) / (bar.high - bar.low) > 0.5
        )

    def limitations(self) -> list[str]:
        return [
            "锤子线需次日阳线确认，单独出现可能为假信号",
            "在横盘震荡中出现的锤子线信号意义较弱",
            "下影线越长、实体越小，反转信号越强",
        ]


class InvertedHammer(PatternDetector):
    """倒锤子 — 下跌趋势末端出现，长上影线，看涨反转信号"""

    pattern_id = "inverted-hammer"
    pattern_name = "倒锤子"
    category = "K线形态"
    direction = "bullish"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        if len(bars) < 6:
            return False
        bar = bars[-1]
        body = _body(bar)
        if body == 0:
            return False
        if bar.high == bar.low:
            return False

        return (
            _is_downtrend(bars)
            and _upper_shadow(bar) >= body * 2
            and _lower_shadow(bar) <= body * 0.3
        )

    def limitations(self) -> list[str]:
        return [
            "倒锤子需次日阳线确认，否则可能只是下跌中继",
            "上影线越长反转意愿越强，但也可能遭遇更大抛压",
            "建议结合成交量确认：倒锤子日放量更可靠",
        ]


class BullishEngulfing(PatternDetector):
    """看涨吞没 — 今日阳线实体完全吞没昨日阴线实体，看涨反转"""

    pattern_id = "bullish-engulfing"
    pattern_name = "看涨吞没"
    category = "K线形态"
    direction = "bullish"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        if len(bars) < 2:
            return False
        yesterday = bars[-2]
        today = bars[-1]

        if yesterday.close >= yesterday.open:  # 昨日需为阴线
            return False
        if today.close <= today.open:  # 今日需为阳线
            return False

        return today.open <= yesterday.close and today.close >= yesterday.open

    def limitations(self) -> list[str]:
        return [
            "吞没形态的有效性取决于两根K线的实体大小，小实体吞没意义有限",
            "需确认处于下跌趋势中，横盘中的吞没形态信号较弱",
            "吞没形态伴随放量更可靠",
        ]


class BearishEngulfing(PatternDetector):
    """看跌吞没 — 今日阴线实体完全吞没昨日阳线实体，看跌反转"""

    pattern_id = "bearish-engulfing"
    pattern_name = "看跌吞没"
    category = "K线形态"
    direction = "bearish"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        if len(bars) < 2:
            return False
        yesterday = bars[-2]
        today = bars[-1]

        if yesterday.close <= yesterday.open:  # 昨日需为阳线
            return False
        if today.close >= today.open:  # 今日需为阴线
            return False

        return today.open >= yesterday.close and today.close <= yesterday.open

    def limitations(self) -> list[str]:
        return [
            "吞没形态的有效性取决于两根K线的实体大小，小实体吞没意义有限",
            "需确认处于上涨趋势中，横盘中的吞没形态信号较弱",
            "吞没形态伴随放量更可靠",
        ]


class Doji(PatternDetector):
    """十字星 — 开盘价≈收盘价，多空力量均衡，可能预示趋势反转"""

    pattern_id = "doji"
    pattern_name = "十字星"
    category = "K线形态"
    direction = "neutral"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        if len(bars) < 1:
            return False
        bar = bars[-1]
        if bar.high == bar.low:
            return False
        return _body(bar) / (bar.high - bar.low) < 0.1

    def limitations(self) -> list[str]:
        return [
            "十字星本身不指示方向，需结合趋势和次日K线判断",
            "高位十字星可能见顶，低位十字星可能见底",
            "连续十字星表明市场极度犹豫",
        ]


class ShootingStar(PatternDetector):
    """射击之星 — 上涨趋势末端出现，长上影线，看跌反转信号"""

    pattern_id = "shooting-star"
    pattern_name = "射击之星"
    category = "K线形态"
    direction = "bearish"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        if len(bars) < 6:
            return False
        bar = bars[-1]
        body = _body(bar)
        if body == 0:
            return False
        if bar.high == bar.low:
            return False

        return (
            _is_uptrend(bars)
            and _upper_shadow(bar) >= body * 2
            and _lower_shadow(bar) <= body * 0.3
            and (bar.close - bar.low) / (bar.high - bar.low) < 0.5
        )

    def limitations(self) -> list[str]:
        return [
            "射击之星需次日阴线确认，否则可能只是上涨中继",
            "上影线越长、实体越小，反转信号越强",
            "在强势上涨趋势中，单根射击之星可能不足以逆转趋势",
        ]


from ..registry import register

register(Hammer())
register(InvertedHammer())
register(BullishEngulfing())
register(BearishEngulfing())
register(Doji())
register(ShootingStar())
