"""真实行情数据导入脚本

数据优先级:
1. Tushare Pro（真实历史数据，需 TUSHARE_TOKEN）
2. 合成数据（本地仿真，开发/演示用）

使用方式:
    docker compose exec backend python scripts/seed_hs300.py            # 导入全部 10 年数据
    docker compose exec backend python scripts/seed_hs300.py --days 90  # 仅最近 90 天
"""

import argparse
import asyncio
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.data.tushare_client import TushareClient, TushareError
from app.database import async_session
from app.engine import list_all
from app.engine.detectors import golden_cross, ma_alignment, volume_price  # noqa: F401
from app.logging import get_logger
from app.models.daily_bar import DailyBar
from app.models.pattern_signal import PatternSignal

logger = get_logger(__name__)

HS300_SAMPLE = [
    ("000001", "平安银行"), ("000002", "万科A"), ("000333", "美的集团"),
    ("000568", "泸州老窖"), ("000651", "格力电器"), ("000858", "五粮液"),
    ("002142", "宁波银行"), ("002415", "海康威视"), ("002594", "比亚迪"),
    ("300750", "宁德时代"), ("600000", "浦发银行"), ("600009", "上海机场"),
    ("600028", "中国石化"), ("600030", "中信证券"), ("600036", "招商银行"),
    ("600048", "保利发展"), ("600276", "恒瑞医药"), ("600309", "万华化学"),
    ("600519", "贵州茅台"), ("600585", "海螺水泥"), ("600809", "山西汾酒"),
    ("600887", "伊利股份"), ("600900", "长江电力"), ("601012", "隆基绿能"),
    ("601088", "中国神华"), ("601166", "兴业银行"), ("601318", "中国平安"),
    ("601398", "工商银行"), ("601668", "中国建筑"), ("601888", "中国中免"),
]

_BACKTEST_DATA: dict[str, dict] = {
    "ma-bullish-alignment": {"forward_20d": {"win_rate": 0.715, "avg_return": 0.0933, "occurrences": 4071}},
    "volume-up-price-up": {"forward_20d": {"win_rate": 0.700, "avg_return": 0.0875, "occurrences": 2720}},
    "volume-price-divergence": {"forward_20d": {"win_rate": 0.694, "avg_return": 0.0640, "occurrences": 307}},
    "ma-convergence-breakout": {"forward_20d": {"win_rate": 0.621, "avg_return": 0.0638, "occurrences": 11394}},
    "golden-cross": {"forward_20d": {"win_rate": 0.653, "avg_return": 0.0734, "occurrences": 1413}},
    "death-cross": {"forward_20d": {"win_rate": 0.689, "avg_return": 0.0642, "occurrences": 1415}},
    "ma-bearish-alignment": {"forward_20d": {"win_rate": 0.664, "avg_return": 0.0627, "occurrences": 5662}},
    "volume-up-price-down": {"forward_20d": {"win_rate": 0.669, "avg_return": 0.0639, "occurrences": 1601}},
}

_DETERMINATIONS: dict[str, str] = {
    "ma-bullish-alignment": "MA5 > MA20 > MA60 > MA120，且四条均线均在昨日基础上继续向上倾斜，表明股价处于强势上升趋势中，多条均线形成多层支撑。",
    "ma-bearish-alignment": "MA5 < MA20 < MA60 < MA120，且四条均线均在昨日基础上继续向下倾斜，表明股价处于弱势下跌趋势中，多条均线形成层层压力。",
    "golden-cross": "短期均线 MA5 从下方上穿长期均线 MA20，形成金叉。通常被视为短期趋势转强的买入参考信号，但在震荡市中可能出现虚假信号。",
    "death-cross": "短期均线 MA5 从上方下穿长期均线 MA20，形成死叉。通常被视为短期趋势转弱的卖出参考信号，需结合成交量和其他指标综合判断。",
    "volume-up-price-up": "当日涨幅超过1%，同时成交量放大至20日均量的1.5倍以上。量价配合良好，表明上涨有资金推动，持续性相对较强。",
    "volume-up-price-down": "当日跌幅超过1%，同时成交量放大至20日均量的1.5倍以上。放量下跌表明抛压较重，需警惕进一步下行风险。",
    "ma-convergence-breakout": "过去20个交易日 MA5/MA20/MA60 三条均线紧密粘合（间距均小于5%），今日 MA5 向上突破。均线粘合后的方向选择往往预示着一段趋势行情的开始。",
    "volume-price-divergence": "股价创20日新高，但成交量反而萎缩至20日均量的80%以下。量价背离表明上涨动力不足，新高可能难以持续，需警惕回调风险。",
}

_RELATED: dict[str, list[str]] = {
    "ma-bullish-alignment": ["ma-bearish-alignment", "golden-cross", "ma-convergence-breakout"],
    "ma-bearish-alignment": ["ma-bullish-alignment", "death-cross"],
    "golden-cross": ["death-cross", "ma-bullish-alignment"],
    "death-cross": ["golden-cross", "ma-bearish-alignment"],
    "volume-up-price-up": ["volume-up-price-down", "volume-price-divergence"],
    "volume-up-price-down": ["volume-up-price-up", "volume-price-divergence"],
    "ma-convergence-breakout": ["ma-bullish-alignment", "golden-cross"],
    "volume-price-divergence": ["volume-up-price-up", "volume-up-price-down"],
}


def compute_mas(closes: list[float]) -> tuple[list, list, list, list]:
    """计算 MA5/MA20/MA60/MA120"""
    n = len(closes)
    ma5 = [round(float(np.mean(closes[max(0, i - 4):i + 1])), 3) if i >= 4 else None for i in range(n)]
    ma20 = [round(float(np.mean(closes[max(0, i - 19):i + 1])), 3) if i >= 19 else None for i in range(n)]
    ma60 = [round(float(np.mean(closes[max(0, i - 59):i + 1])), 3) if i >= 59 else None for i in range(n)]
    ma120 = [round(float(np.mean(closes[max(0, i - 119):i + 1])), 3) if i >= 119 else None for i in range(n)]
    return ma5, ma20, ma60, ma120


async def clear_existing(db: AsyncSession):
    """清空已有数据"""
    await db.execute(text("DELETE FROM pattern_signals"))
    await db.execute(text("DELETE FROM daily_bars"))
    await db.commit()
    logger.info("cleared_existing_data")


async def import_from_tushare(db: AsyncSession, days: int) -> tuple[int, int]:
    """从 Tushare 导入真实日线数据，计算 MA，运行形态检测

    Returns: (日线条数, 信号条数)
    """
    token = settings.tushare_token
    if not token:
        raise TushareError("TUSHARE_TOKEN 未配置")

    end_date = date.today().strftime("%Y%m%d")
    start_date = (date.today() - timedelta(days=days)).strftime("%Y%m%d")

    client = TushareClient(token)
    total_bars = 0
    total_signals = 0

    for idx, (code, name) in enumerate(HS300_SAMPLE):
        ts_code = TushareClient.to_ts_code(code)

        print(f"[{idx + 1:2d}/30] {code} {name} ...", end=" ", flush=True)

        # 1. 获取日线数据
        df = await client.fetch_daily(ts_code, start_date, end_date)
        if df is None or df.empty:
            print("无数据，跳过")
            continue

        # 2. 写入 daily_bars
        bars_inserted = 0
        batch: list[DailyBar] = []
        for _, row in df.iterrows():
            bar_date = datetime.strptime(str(row["trade_date"]), "%Y%m%d").date()

            exists = await db.execute(
                select(DailyBar).where(DailyBar.code == code, DailyBar.date == bar_date)
            )
            if exists.scalar_one_or_none() is not None:
                continue

            bar = DailyBar(
                code=code,
                date=bar_date,
                open=float(row["open"]),
                high=float(row["high"]),
                low=float(row["low"]),
                close=float(row["close"]),
                volume=int(float(row["vol"])),
                amount=float(row.get("amount", 0) or 0),
            )
            batch.append(bar)
            bars_inserted += 1

            if len(batch) >= 500:
                db.add_all(batch)
                await db.commit()
                batch = []

        if batch:
            db.add_all(batch)
            await db.commit()

        total_bars += bars_inserted

        # 3. 计算并写入 MA
        bars_result = await db.execute(
            select(DailyBar)
            .where(DailyBar.code == code)
            .order_by(DailyBar.date.asc())
        )
        all_bars = list(bars_result.scalars().all())
        closes = [b.close for b in all_bars]
        ma5, ma20, ma60, ma120 = compute_mas(closes)

        for i, bar in enumerate(all_bars):
            bar.ma5 = ma5[i]
            bar.ma20 = ma20[i]
            bar.ma60 = ma60[i]
            bar.ma120 = ma120[i]
        await db.commit()

        # 4. 运行形态检测 (需要 >= 120 根 bar)
        if len(all_bars) < 120:
            print(f"{bars_inserted} 条日线 (数据不足，跳过形态检测)")
            continue

        signals_inserted = 0
        # 重新加载含 MA 的 bars（日期升序）
        for pid, detector in list_all().items():
            for i in range(120, len(all_bars)):
                if detector.match(all_bars[:i + 1]):
                    bt = _BACKTEST_DATA.get(pid, {})
                    db.add(PatternSignal(
                        code=code,
                        date=all_bars[i].date,
                        pattern_id=pid,
                        pattern_name=detector.pattern_name,
                        category=detector.category,
                        direction=detector.direction,
                        confidence=1.0,
                        description=_DETERMINATIONS.get(pid, detector.describe()),
                        backtest=bt.get("forward_20d", {}),
                        limitations=detector.limitations(),
                        related_patterns=_RELATED.get(pid, []),
                    ))
                    signals_inserted += 1

        await db.commit()
        total_signals += signals_inserted

        print(f"{bars_inserted} 条日线, {signals_inserted} 个信号")

    return total_bars, total_signals


async def import_synthetic(db: AsyncSession):
    """fallback: 使用合成数据"""
    from scripts.generate_synthetic_data import main as gen_main

    print("Tushare 不可用，使用合成数据作为 fallback ...")
    await clear_existing(db)
    await gen_main()


async def data_summary() -> dict:
    """输出数据库概览"""
    async with async_session() as db:
        result = await db.execute(text("SELECT COUNT(*) FROM daily_bars"))
        total = result.scalar()
        result = await db.execute(text("SELECT COUNT(DISTINCT code) FROM daily_bars"))
        stocks = result.scalar()
        result = await db.execute(text("SELECT MIN(date), MAX(date) FROM daily_bars"))
        row = result.fetchone()
        result = await db.execute(text("SELECT COUNT(*) FROM pattern_signals"))
        sigs = result.scalar()
        return {
            "total_bars": total, "stocks": stocks,
            "earliest": str(row[0]) if row[0] else "-",
            "latest": str(row[1]) if row[1] else "-",
            "total_signals": sigs,
        }


async def main():
    parser = argparse.ArgumentParser(description="导入 A 股真实行情数据")
    parser.add_argument("--days", type=int, default=2500,
                        help="回溯天数 (默认 2500，约10年)")
    parser.add_argument("--fallback", action="store_true",
                        help="跳过 Tushare，直接使用合成数据")
    args = parser.parse_args()

    print("=== 炒股学堂 数据导入 ===\n")

    if args.fallback:
        async with async_session() as db:
            await import_synthetic(db)
        summary = await data_summary()
        print(f"\n完成: {summary}")
        return

    # 尝试 Tushare
    async with async_session() as db:
        try:
            await clear_existing(db)
            bars, sigs = await import_from_tushare(db, args.days)
            print(f"\n[完成] 总计: {bars} 条日线, {sigs} 个形态信号")
        except TushareError as e:
            print(f"\nTushare 不可用: {e}")
            await import_synthetic(db)

    summary = await data_summary()
    print(f"数据库状态: {summary['stocks']} 只股票, "
          f"{summary['total_bars']} 条日线, "
          f"{summary['total_signals']} 个信号")
    print(f"日期范围: {summary['earliest']} ~ {summary['latest']}")


if __name__ == "__main__":
    asyncio.run(main())
