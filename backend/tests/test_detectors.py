"""形态检测器单元测试"""
from app.engine import get, list_all
from app.engine.detectors.golden_cross import DeathCross, GoldenCross
from app.engine.detectors.ma_alignment import MABearishAlignment, MABullishAlignment
from app.engine.detectors.candlestick import (
    BearishEngulfing,
    BullishEngulfing,
    Doji,
    Hammer,
    InvertedHammer,
    ShootingStar,
)
from app.engine.detectors.volume_price import (
    MAConvergenceBreakout,
    VolumePriceDivergence,
    VolumeUpPriceDown,
    VolumeUpPriceUp,
)

from .conftest import make_bars


class TestGoldenCross:
    def test_ma5_crosses_above_ma20_triggers(self):
        closes = [10.0] * 21  # 21 根 K线确保 yesterday 和 today 都有有效 MA20
        closes[-1] = 15.0  # 今天大幅拉升，MA5 上穿 MA20
        bars = make_bars(closes)
        detector = GoldenCross()
        assert detector.match(bars) is True

    def test_no_cross_returns_false(self):
        closes = [10.0] * 22
        bars = make_bars(closes)
        detector = GoldenCross()
        assert detector.match(bars) is False

    def test_too_few_bars_returns_false(self):
        bars = make_bars([10.0, 10.5])
        detector = GoldenCross()
        assert detector.match(bars) is False


class TestDeathCross:
    def test_ma5_crosses_below_ma20_triggers(self):
        closes = [20.0] * 21
        closes[-1] = 15.0  # 今天加速下跌，MA5 下穿 MA20
        bars = make_bars(closes)
        detector = DeathCross()
        assert detector.match(bars) is True

    def test_no_cross_returns_false(self):
        closes = [20.0] * 22
        bars = make_bars(closes)
        detector = DeathCross()
        assert detector.match(bars) is False


class TestMABullishAlignment:
    def test_uptrend_triggers(self):
        closes = list(range(10, 140))  # 120+ 天持续上涨
        bars = make_bars(closes)
        detector = MABullishAlignment()
        assert detector.match(bars) is True

    def test_downtrend_returns_false(self):
        closes = list(range(140, 10, -1))
        bars = make_bars(closes)
        detector = MABullishAlignment()
        assert detector.match(bars) is False

    def test_too_few_bars_returns_false(self):
        bars = make_bars(list(range(10, 20)))
        detector = MABullishAlignment()
        assert detector.match(bars) is False


class TestMABearishAlignment:
    def test_downtrend_triggers(self):
        closes = list(range(140, 10, -1))
        bars = make_bars(closes)
        detector = MABearishAlignment()
        assert detector.match(bars) is True

    def test_uptrend_returns_false(self):
        closes = list(range(10, 140))
        bars = make_bars(closes)
        detector = MABearishAlignment()
        assert detector.match(bars) is False


class TestVolumeUpPriceUp:
    def test_volume_up_price_up_triggers(self):
        closes = [10.0] * 21
        closes[-1] = 10.3  # 涨 3%
        volumes = [100000] * 21
        volumes[-1] = 3000000  # 量比 30x
        bars = make_bars(closes, volumes=volumes)
        detector = VolumeUpPriceUp()
        assert detector.match(bars) is True

    def test_small_gain_returns_false(self):
        closes = [10.0] * 21
        closes[-1] = 10.05  # 只涨 0.5%
        volumes = [100000] * 21
        volumes[-1] = 3000000
        bars = make_bars(closes, volumes=volumes)
        detector = VolumeUpPriceUp()
        assert detector.match(bars) is False

    def test_low_volume_returns_false(self):
        closes = [10.0] * 21
        closes[-1] = 10.3
        volumes = [100000] * 21
        volumes[-1] = 110000  # 量比 1.1x
        bars = make_bars(closes, volumes=volumes)
        detector = VolumeUpPriceUp()
        assert detector.match(bars) is False


class TestVolumeUpPriceDown:
    def test_volume_up_price_down_triggers(self):
        closes = [20.0] * 21
        closes[-1] = 19.0  # 跌 5%
        volumes = [100000] * 21
        volumes[-1] = 3000000
        bars = make_bars(closes, volumes=volumes)
        detector = VolumeUpPriceDown()
        assert detector.match(bars) is True

    def test_small_loss_returns_false(self):
        closes = [20.0] * 21
        closes[-1] = 19.95  # 只跌 0.25%
        volumes = [100000] * 21
        volumes[-1] = 3000000
        bars = make_bars(closes, volumes=volumes)
        detector = VolumeUpPriceDown()
        assert detector.match(bars) is False


class TestMAConvergenceBreakout:
    def test_convergence_then_breakout_triggers(self):
        # 80 天横盘确保 MA60 有效 + 20 天收敛期所有 bar 都有 MA60
        closes = [15.0] * 80
        closes[-1] = 15.3  # 今天突破
        volumes = [100000] * 80
        bars = make_bars(closes, volumes=volumes)
        detector = MAConvergenceBreakout()
        assert detector.match(bars) is True

    def test_always_diverged_returns_false(self):
        closes = list(range(10, 95))  # 持续上涨，均线发散
        bars = make_bars(closes)
        detector = MAConvergenceBreakout()
        assert detector.match(bars) is False


class TestVolumePriceDivergence:
    def test_price_high_volume_low_triggers(self):
        closes = [10.0 + i * 0.01 for i in range(22)]
        closes[-1] = 12.0
        volumes = [200000] * 22
        volumes[-1] = 100000  # 缩量
        highs = [c * 1.02 for c in closes]
        highs[-1] = 12.5  # 创 20 日新高
        bars = make_bars(closes, volumes=volumes, highs=highs)
        detector = VolumePriceDivergence()
        assert detector.match(bars) is True

    def test_price_high_volume_normal_returns_false(self):
        closes = [10.0 + i * 0.05 for i in range(22)]
        closes[-1] = 12.0
        volumes = [200000] * 22
        volumes[-1] = 250000  # 放量
        bars = make_bars(closes, volumes=volumes)
        detector = VolumePriceDivergence()
        assert detector.match(bars) is False


class TestHammer:
    def test_downtrend_long_lower_shadow_triggers(self):
        # 前 6 根持续下跌，最后一根锤子线
        closes = [15.0, 14.5, 14.0, 13.5, 13.0, 12.5, 12.5]
        opens = [15.0] * len(closes)
        opens[-1] = 12.4  # body = 0.1
        highs = [c + 0.02 for c in closes]
        highs[-1] = 12.52  # upper_shadow = 0.02, body*0.3 = 0.03 ✓
        lows = [c - 0.02 for c in closes]
        lows[-1] = 12.0   # lower_shadow = 0.4, body*2 = 0.2 ✓
        bars = make_bars(closes, opens=opens, highs=highs, lows=lows)
        detector = Hammer()
        assert detector.match(bars) is True

    def test_uptrend_returns_false(self):
        closes = list(range(10, 32))
        bars = make_bars(closes)
        detector = Hammer()
        assert detector.match(bars) is False

    def test_no_lower_shadow_returns_false(self):
        closes = list(range(15, 10, -1)) * 3
        closes = closes[:22]
        bars = make_bars(closes)
        detector = Hammer()
        assert detector.match(bars) is False


class TestInvertedHammer:
    def test_downtrend_long_upper_shadow_triggers(self):
        closes = [15.0, 14.5, 14.0, 13.5, 13.0, 12.5, 12.5]
        opens = [15.0] * len(closes)
        opens[-1] = 12.4  # body = 0.1
        highs = [c + 0.02 for c in closes]
        highs[-1] = 12.8  # upper_shadow = 0.3, body*2 = 0.2 ✓
        lows = [c - 0.02 for c in closes]
        lows[-1] = 12.38 # lower_shadow = 0.02, body*0.3 = 0.03 ✓
        bars = make_bars(closes, opens=opens, highs=highs, lows=lows)
        detector = InvertedHammer()
        assert detector.match(bars) is True

    def test_uptrend_returns_false(self):
        closes = list(range(10, 32))
        bars = make_bars(closes)
        detector = InvertedHammer()
        assert detector.match(bars) is False


class TestBullishEngulfing:
    def test_yin_then_yang_engulf_triggers(self):
        closes = [10.0] * 22
        opens = [10.0] * 22
        closes[-2] = 9.5  # 昨收 < 昨开 (阴线)
        opens[-2] = 10.0
        opens[-1] = 9.3   # 今开 < 昨收
        closes[-1] = 10.2  # 今收 > 昨开 (完全吞没)
        bars = make_bars(closes, opens=opens)
        detector = BullishEngulfing()
        assert detector.match(bars) is True

    def test_no_engulf_returns_false(self):
        closes = [10.0] * 22
        opens = [10.0] * 22
        closes[-2] = 9.5
        opens[-2] = 10.0
        opens[-1] = 9.8   # 今开 > 昨收 (没有吞没)
        closes[-1] = 10.2
        bars = make_bars(closes, opens=opens)
        detector = BullishEngulfing()
        assert detector.match(bars) is False


class TestBearishEngulfing:
    def test_yang_then_yin_engulf_triggers(self):
        closes = [10.0] * 22
        opens = [10.0] * 22
        closes[-2] = 10.5  # 昨收 > 昨开 (阳线)
        opens[-2] = 10.0
        opens[-1] = 10.7   # 今开 > 昨收
        closes[-1] = 9.8   # 今收 < 昨开 (完全吞没)
        bars = make_bars(closes, opens=opens)
        detector = BearishEngulfing()
        assert detector.match(bars) is True

    def test_no_engulf_returns_false(self):
        closes = [10.0] * 22
        opens = [10.0] * 22
        closes[-2] = 10.5
        opens[-2] = 10.0
        opens[-1] = 10.4
        closes[-1] = 10.1  # 今收 > 昨开 (没有完全吞没)
        bars = make_bars(closes, opens=opens)
        detector = BearishEngulfing()
        assert detector.match(bars) is False


class TestDoji:
    def test_tiny_body_triggers(self):
        closes = [10.0] * 22
        opens = [10.0] * 22
        closes[-1] = 10.005  # 几乎等于开盘
        opens[-1] = 10.0
        highs = [c + 0.10 for c in closes]
        highs[-1] = 10.15
        lows = [c - 0.10 for c in closes]
        lows[-1] = 9.85
        bars = make_bars(closes, opens=opens, highs=highs, lows=lows)
        detector = Doji()
        assert detector.match(bars) is True

    def test_large_body_returns_false(self):
        closes = [10.0] * 22
        closes[-1] = 10.5  # 大实体
        opens = [10.0] * 22
        opens[-1] = 10.0
        highs = [c + 0.10 for c in closes]
        lows = [c - 0.10 for c in closes]
        bars = make_bars(closes, opens=opens, highs=highs, lows=lows)
        detector = Doji()
        assert detector.match(bars) is False


class TestShootingStar:
    def test_uptrend_long_upper_shadow_triggers(self):
        closes = [10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 12.8]  # 持续上涨
        opens = [c - 0.02 for c in closes]
        # 最后一根手动构造：小实体 + 长上影 + 短下影 + 收盘在下半区
        opens[-1] = 12.70
        closes[-1] = 12.80  # body = 0.1
        highs = [max(o, c) + 0.02 for o, c in zip(opens, closes)]
        highs[-1] = 13.10  # upper_shadow = 13.1-12.8 = 0.3, >= 0.1*2 ✓
        lows = [min(o, c) - 0.02 for o, c in zip(opens, closes)]
        lows[-1] = 12.68  # lower_shadow = 12.7-12.68 = 0.02, <= 0.1*0.3=0.03 ✓
        # (close-low)/(high-low) = (12.8-12.68)/(13.1-12.68) = 0.12/0.42 = 0.29 < 0.5 ✓
        bars = make_bars(closes, opens=opens, highs=highs, lows=lows)
        detector = ShootingStar()
        assert detector.match(bars) is True

    def test_downtrend_returns_false(self):
        closes = list(range(15, 10, -1)) * 3
        closes = closes[:22]
        bars = make_bars(closes)
        detector = ShootingStar()
        assert detector.match(bars) is False


class TestRegistry:
    def test_all_14_detectors_registered(self):
        all_d = list_all()
        assert len(all_d) == 14

    def test_get_returns_correct_detector(self):
        d = get("golden-cross")
        assert d is not None
        assert d.pattern_id == "golden-cross"
        assert d.pattern_name == "金叉"

    def test_get_nonexistent_returns_none(self):
        assert get("nonexistent") is None

    def test_all_pattern_ids_unique(self):
        all_d = list_all()
        ids = list(all_d.keys())
        assert len(ids) == len(set(ids))
