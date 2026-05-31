"""量价关系检测器：放量上涨、放量下跌、量价背离、均线粘合发散"""

from collections.abc import Sequence

from ..base import PatternDetector
from ...models.daily_bar import DailyBar


def _volume_ratio(bars: Sequence[DailyBar]) -> float | None:
    """当日成交量 / 过去20日均量"""
    if len(bars) < 21:
        return None
    today = bars[-1]
    avg_vol = sum(b.volume for b in bars[-21:-1]) / 20
    if avg_vol == 0:
        return None
    return today.volume / avg_vol


class VolumeUpPriceUp(PatternDetector):
    pattern_id = "volume-up-price-up"
    pattern_name = "放量上涨"
    category = "量价"
    direction = "bullish"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        if len(bars) < 21:
            return False
        today = bars[-1]
        yesterday = bars[-2]
        change_pct = (today.close - yesterday.close) / yesterday.close
        if change_pct <= 0.01:
            return False
        vr = _volume_ratio(bars)
        if vr is None or vr <= 1.5:
            return False
        return True

    def limitations(self) -> list[str]:
        return ["放量上涨次日可能出现获利回吐", "高位放量可能是出货信号，需结合位置判断"]


class VolumeUpPriceDown(PatternDetector):
    pattern_id = "volume-up-price-down"
    pattern_name = "放量下跌"
    category = "量价"
    direction = "bearish"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        if len(bars) < 21:
            return False
        today = bars[-1]
        yesterday = bars[-2]
        change_pct = (today.close - yesterday.close) / yesterday.close
        if change_pct >= -0.01:
            return False
        vr = _volume_ratio(bars)
        if vr is None or vr <= 1.5:
            return False
        return True

    def limitations(self) -> list[str]:
        return ["低位放量下跌可能是恐慌盘出清后的反弹前兆", "跌停板放量不计入回测（成交受限）"]


class MAConvergenceBreakout(PatternDetector):
    pattern_id = "ma-convergence-breakout"
    pattern_name = "均线粘合向上发散"
    category = "均线"
    direction = "bullish"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        """过去20日 MA5/MA20/MA60 间距均 < 5%，今日 MA5 上翘突破"""
        if len(bars) < 21:
            return False
        today = bars[-1]
        yesterday = bars[-2]

        ma_values = [today.ma5, today.ma20, today.ma60]
        if any(v is None for v in ma_values):
            return False

        # 检查过去20日三条均线的最大间距 < 5%
        avg_price = sum(ma_values) / 3
        for i in range(-20, 0):
            b = bars[i]
            if None in (b.ma5, b.ma20, b.ma60):
                return False
            b_avg = (b.ma5 + b.ma20 + b.ma60) / 3
            spread = max(abs(b.ma5 - b_avg), abs(b.ma20 - b_avg), abs(b.ma60 - b_avg)) / b_avg
            if spread >= 0.05:
                return False

        # 今日 MA5 上翘突破（斜率转正）
        if yesterday.ma5 is None or today.ma5 <= yesterday.ma5:
            return False

        return True

    def limitations(self) -> list[str]:
        return ["粘合状态可能持续数周才选择方向", "假突破后快速回落是常见失败模式"]


class VolumePriceDivergence(PatternDetector):
    pattern_id = "volume-price-divergence"
    pattern_name = "量价背离"
    category = "量价"
    direction = "bearish"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        """股价创 20 日新高但量比 < 0.8"""
        if len(bars) < 22:
            return False
        today = bars[-1]
        high_20d = max(b.high for b in bars[-21:-1])
        if today.high <= high_20d:
            return False
        vr = _volume_ratio(bars)
        if vr is None or vr >= 0.8:
            return False
        return True

    def limitations(self) -> list[str]:
        return ["无量新高在筹码集中股中可能是控盘信号而非背离", "需排除因分红除权导致的价格新高假象"]


from ..registry import register
register(VolumeUpPriceUp())
register(VolumeUpPriceDown())
register(MAConvergenceBreakout())
register(VolumePriceDivergence())
