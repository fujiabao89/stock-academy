"""每日盘后形态匹配批处理脚本

收盘后运行：遍历所有股票的最新日线 → 对每只股票跑所有形态检测器 → 写入 pattern_signals 表

使用方式：
    docker compose exec backend python scripts/run_pattern_match.py
    docker compose exec backend python scripts/run_pattern_match.py --code 000001  # 单只股票
"""

import argparse
import asyncio
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.engine import list_all
from app.engine.detectors import golden_cross, ma_alignment, volume_price  # noqa: F401
from app.logging import get_logger
from app.models.daily_bar import DailyBar
from app.models.pattern_signal import PatternSignal

logger = get_logger(__name__)

# 形态的白话解释模板
DESCRIPTION_TEMPLATES = {
    "ma-bullish-alignment": "均线呈多头排列（短期均线在上，长期均线在下），且四条均线均向上倾斜，表明股价处于上升趋势中，多方力量占优。历史上这种情况后续20个交易日内最高涨幅达到3%的概率约为 {win_rate}。",
    "ma-bearish-alignment": "均线呈空头排列（短期均线在下，长期均线在上），且四条均线均向下倾斜，表明股价处于下降趋势中，空方力量占优。",
    "golden-cross": "MA5（5日均线）上穿 MA20（20日均线），形成金叉信号。短期趋势转强，历史上这种情况后续20个交易日内最高涨幅达到3%的概率约为 {win_rate}。注意：金叉是瞬时信号，仅在触发日有效。",
    "death-cross": "MA5（5日均线）下穿 MA20（20日均线），形成死叉信号。短期趋势转弱。注意：死叉是瞬时信号，仅在触发日有效。",
    "volume-up-price-up": "当日成交量超过过去20日均量的1.5倍，且股价上涨超过1%，属于放量上涨。量价配合良好，表明有资金主动买入。",
    "volume-up-price-down": "当日成交量超过过去20日均量的1.5倍，且股价下跌超过1%，属于放量下跌。量价配合显示抛压明显，需关注后续能否企稳。",
    "ma-convergence-breakout": "过去20个交易日 MA5、MA20、MA60 三条均线间距均小于5%（均线粘合），今日 MA5 向上突破。均线粘合后向上发散通常是趋势启动的信号。",
    "volume-price-divergence": "股价创20日新高，但成交量低于过去20日均量的80%，形成量价背离。无量新高表明追涨动力不足，需警惕回调风险。",
}


async def match_single_stock(db: AsyncSession, code: str, target_date: date):
    """对单只股票在指定日期进行形态匹配"""
    # 加载该股票的历史日线（至少120天）
    bars_result = await db.execute(
        select(DailyBar)
        .where(DailyBar.code == code, DailyBar.date <= target_date)
        .order_by(DailyBar.date.desc())
        .limit(200)
    )
    bars = list(reversed(bars_result.scalars().all()))

    if len(bars) < 121:
        logger.debug("insufficient_data", code=code, bars=len(bars))
        return

    today = bars[-1]
    if today.date != target_date:
        logger.debug("date_mismatch", code=code, expected=target_date, actual=today.date)
        return

    for pid, detector in list_all().items():
        try:
            if detector.match(bars):
                template = DESCRIPTION_TEMPLATES.get(pid, detector.describe())
                signal = PatternSignal(
                    code=code,
                    date=target_date,
                    pattern_id=pid,
                    pattern_name=detector.pattern_name,
                    category=detector.category,
                    direction=detector.direction,
                    confidence=1.0,  # MVP 阶段固定为 1.0
                    description=template.format(win_rate="--"),
                    backtest={},
                    limitations=detector.limitations(),
                    related_patterns=[],
                )
                db.add(signal)
                logger.info("signal_detected", code=code, pattern=pid)
        except Exception as e:
            logger.error("detector_error", code=code, pattern=pid, error=str(e))

    await db.commit()


async def main():
    parser = argparse.ArgumentParser(description="盘后形态匹配批处理")
    parser.add_argument("--code", type=str, help="单只股票代码")
    parser.add_argument("--date", type=str, help="匹配日期 YYYY-MM-DD，默认为最新交易日")
    args = parser.parse_args()

    target_date = date.fromisoformat(args.date) if args.date else date.today()

    async with async_session() as db:
        if args.code:
            codes = [args.code]
        else:
            # 获取所有有当日数据的股票
            codes_result = await db.execute(
                select(DailyBar.code)
                .where(DailyBar.date == target_date)
                .distinct()
            )
            codes = [row[0] for row in codes_result.fetchall()]

        logger.info("pattern_match_start", codes=len(codes), date=str(target_date))

        for i, code in enumerate(codes):
            await match_single_stock(db, code, target_date)
            if (i + 1) % 50 == 0:
                logger.info("pattern_match_progress", done=i + 1, total=len(codes))

        logger.info("pattern_match_done", total=len(codes))


if __name__ == "__main__":
    asyncio.run(main())
