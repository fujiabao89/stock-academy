"""K线数据每日更新 — 收盘后通过 Tushare 批量拉取最新日线"""

import asyncio
from datetime import date, datetime, timedelta

from sqlalchemy import select, text

from ..config import settings
from ..data.tushare_client import TushareClient
from ..database import async_session
from ..logging import get_logger
from ..models.daily_bar import DailyBar
from ..models.pattern_signal import PatternSignal
from ..engine import list_all
from scripts.seed_hs300 import _BarsView, _BACKTEST_DATA, _DETERMINATIONS, _RELATED, compute_mas

logger = get_logger(__name__)

BATCH_SIZE = 50  # 每批股票数


async def _insert_bars_and_recalc(db, code: str, bars_data: list[dict]) -> int:
    """将批量拉取的日线写入单只股票并重算 MA / 形态，返回新增条数"""
    if not bars_data:
        return 0

    inserted = 0
    for bd in bars_data:
        bar_date = datetime.strptime(bd["trade_date"], "%Y%m%d").date()
        exists = await db.execute(
            select(DailyBar.id).where(DailyBar.code == code, DailyBar.date == bar_date)
        )
        if exists.scalar_one_or_none() is not None:
            continue
        db.add(DailyBar(
            code=code,
            date=bar_date,
            open=float(bd["open"]),
            high=float(bd["high"]),
            low=float(bd["low"]),
            close=float(bd["close"]),
            volume=int(float(bd["vol"])),
            amount=float(bd.get("amount", 0) or 0),
        ))
        inserted += 1

    if inserted == 0:
        return 0

    await db.commit()

    # 重新计算全部 MA
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

    # 对新增日期附近的 bar 检测形态
    if len(all_bars) >= 120:
        signals_added = 0
        for pid, detector in list_all().items():
            for i in range(max(120, len(all_bars) - inserted - 60), len(all_bars)):
                if detector.match(_BarsView(all_bars, i + 1)):
                    sig_date = all_bars[i].date
                    already = await db.execute(
                        select(PatternSignal.id).where(
                            PatternSignal.code == code,
                            PatternSignal.date == sig_date,
                            PatternSignal.pattern_id == pid,
                        )
                    )
                    if already.scalar_one_or_none() is not None:
                        continue
                    bt = _BACKTEST_DATA.get(pid, {})
                    db.add(PatternSignal(
                        code=code,
                        date=sig_date,
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
                    signals_added += 1
        if signals_added > 0:
            await db.commit()

    return inserted


async def _update_all_stocks() -> None:
    """批量拉取全市场最新日线数据"""
    token = settings.tushare_token
    if not token:
        logger.warning("TUSHARE_TOKEN 未配置，跳过 K 线更新")
        return

    client = TushareClient(token)
    today_str = date.today().strftime("%Y%m%d")

    async with async_session() as db:
        # 获取所有股票及其最新日期
        rows = await db.execute(
            text("SELECT code, MAX(date) FROM daily_bars GROUP BY code")
        )
        stock_info: dict[str, str] = {}
        for r in rows.fetchall():
            code, max_date = r[0], r[1]
            if max_date is not None:
                stock_info[code] = max_date.strftime("%Y%m%d")

        codes = sorted(stock_info.keys())
        logger.info("K线每日更新开始", stocks=len(codes))

        total_inserted = 0
        updated = 0

        # 按批次处理
        for batch_start in range(0, len(codes), BATCH_SIZE):
            batch_codes = codes[batch_start:batch_start + BATCH_SIZE]
            batch_parts = []
            for code in batch_codes:
                ts_code = TushareClient.to_ts_code(code)
                start_date = stock_info[code]
                # 如果最新日期已经是今天，跳过
                if start_date >= today_str:
                    continue
                batch_parts.append((code, ts_code, start_date))

            if not batch_parts:
                continue

            # 本批次中最早的 start_date 和所有 ts_codes
            min_start = min(p[2] for p in batch_parts)
            ts_codes_str = ",".join(p[1] for p in batch_parts)

            try:
                df = await client.fetch_daily(ts_codes_str, min_start, today_str)
            except Exception as exc:
                logger.warning("K线批量拉取失败", batch=batch_start, error=str(exc)[:150])
                await asyncio.sleep(1.5)
                continue

            if df is None or df.empty:
                await asyncio.sleep(1.5)
                continue

            # 按股票分组写入
            for code, ts_code, start_date in batch_parts:
                stock_df = df[df["ts_code"] == ts_code]
                if stock_df.empty:
                    continue
                bars_data = []
                for _, row in stock_df.iterrows():
                    bars_data.append({
                        "trade_date": str(row["trade_date"]),
                        "open": float(row["open"]),
                        "high": float(row["high"]),
                        "low": float(row["low"]),
                        "close": float(row["close"]),
                        "vol": int(float(row["vol"])),
                        "amount": float(row.get("amount", 0) or 0),
                    })
                try:
                    n = await _insert_bars_and_recalc(db, code, bars_data)
                    if n > 0:
                        updated += 1
                        total_inserted += n
                except Exception as exc:
                    logger.warning("K线写入失败", code=code, error=str(exc)[:150])

            # 进度日志
            done = batch_start + len(batch_codes)
            if done % 500 == 0 or done >= len(codes):
                logger.info("K线更新进度", done=min(done, len(codes)), total=len(codes), updated=updated, inserted=total_inserted)

            await asyncio.sleep(1.5)  # Tushare 频率限制

        logger.info("K线每日更新完成", updated=updated, total_inserted=total_inserted)
