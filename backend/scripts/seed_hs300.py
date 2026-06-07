"""真实行情数据导入脚本

数据优先级:
1. Tushare Pro（真实历史数据，需 TUSHARE_TOKEN）
2. 合成数据（本地仿真，开发/演示用）

使用方式:
    docker compose exec backend python scripts/seed_hs300.py                     # 增量导入全部 A 股
    docker compose exec backend python scripts/seed_hs300.py --days 90           # 仅最近 90 天
    docker compose exec backend python scripts/seed_hs300.py --max-stocks 100    # 限制 100 只
    docker compose exec backend python scripts/seed_hs300.py --resume            # 断点续传
    docker compose exec backend python scripts/seed_hs300.py --clear             # 清空重建
"""

import argparse
import asyncio
import json
import sys
from collections.abc import Sequence
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

PROGRESS_FILE = Path(__file__).parent / ".seed_progress.json"
STOCK_LIST_CACHE = Path(__file__).parent / ".stock_list_cache.json"


class _BarsView(Sequence):
    """零拷贝列表视图，避免 O(n²) 切片复制"""

    __slots__ = ("_data", "_stop")

    def __init__(self, data, stop):
        self._data = data
        self._stop = stop

    def __getitem__(self, key):
        if isinstance(key, slice):
            start, stop, step = key.indices(self._stop)
            return [self._data[i] for i in range(start, stop, step)]
        if key < 0:
            key += self._stop
        if key < 0 or key >= self._stop:
            raise IndexError
        return self._data[key]

    def __len__(self):
        return self._stop


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


def load_progress() -> set[str]:
    """加载已完成的股票代码集合"""
    if not PROGRESS_FILE.exists():
        return set()
    try:
        data = json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
        return set(data.get("completed", []))
    except (json.JSONDecodeError, KeyError):
        return set()


def save_progress(completed: set[str]):
    """保存进度到文件"""
    PROGRESS_FILE.write_text(
        json.dumps({"completed": sorted(completed), "updated_at": datetime.now().isoformat()},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


async def fetch_stock_list(client: TushareClient, codes: list[str] | None = None) -> list[tuple[str, str]]:
    """获取股票列表

    优先级: 指定的 codes > 本地缓存 > 全市场（Tushare stock_basic） > HS300 兜底
    """
    if codes:
        return [(c, "") for c in codes]

    # 1. 优先读取本地缓存
    if STOCK_LIST_CACHE.exists():
        try:
            data = json.loads(STOCK_LIST_CACHE.read_text(encoding="utf-8"))
            stocks = data.get("stocks", [])
            if stocks:
                print(f"从本地缓存获取到 {len(stocks)} 只上市股票")
                return stocks
        except (json.JSONDecodeError, KeyError):
            pass

    # 2. 调用 Tushare API
    try:
        df = await client.fetch_stock_basic()
        if df is not None and not df.empty:
            stocks = [(str(row["symbol"]), str(row["name"])) for _, row in df.iterrows()]
            print(f"从 Tushare 获取到 {len(stocks)} 只上市股票")
            # 缓存到本地
            STOCK_LIST_CACHE.write_text(
                json.dumps({"stocks": stocks, "updated_at": datetime.now().isoformat()},
                           ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            return stocks
    except TushareError as e:
        print(f"获取股票列表失败: {e}")

    print(f"使用 HS300 样本 ({len(HS300_SAMPLE)} 只) 作为兜底")
    return list(HS300_SAMPLE)


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


async def import_from_tushare(
    db: AsyncSession, days: int, *,
    skip_existing: bool = True,
    stocks: list[tuple[str, str]] | None = None,
    max_stocks: int = 0,
    resume: bool = False,
) -> tuple[int, int, int]:
    """从 Tushare 导入真实日线数据，计算 MA，运行形态检测

    skip_existing: 跳过已有数据的股票（增量导入模式）
    stocks: 股票列表，None 则使用 HS300_SAMPLE
    max_stocks: 本轮最多导入股票数（0 = 无限制）
    resume: 是否从进度文件恢复

    Returns: (日线条数, 信号条数, 已跳过的股票数)
    """
    token = settings.tushare_token
    if not token:
        raise TushareError("TUSHARE_TOKEN 未配置")

    end_date = date.today().strftime("%Y%m%d")
    start_date = (date.today() - timedelta(days=days)).strftime("%Y%m%d")

    client = TushareClient(token)

    # 获取股票列表
    if stocks is None:
        stocks = list(HS300_SAMPLE)

    total_count = len(stocks)
    completed = load_progress() if resume else set()
    initial_completed = len(completed)

    if resume and completed:
        remaining = total_count - initial_completed
        print(f"从进度文件恢复: {initial_completed} 已完成, {remaining} 待处理")

    total_bars = 0
    total_signals = 0
    skipped = 0

    for idx, (code, name) in enumerate(stocks):
        # 断点续传：跳过已完成的
        if resume and code in completed:
            skipped += 1
            continue

        # 显示进度
        progress = f"[{idx + 1}/{total_count}]"
        name_display = f"{name}" if name else ""
        ts_code = TushareClient.to_ts_code(code)

        # 增量模式：跳过已有数据的股票
        if skip_existing:
            existing = await db.execute(
                select(DailyBar).where(DailyBar.code == code).limit(1)
            )
            if existing.scalar_one_or_none() is not None:
                skipped += 1
                if resume:
                    completed.add(code)
                    save_progress(completed)
                else:
                    print(f"{progress} {code} {name_display} — 已有数据，跳过")
                continue

        print(f"{progress} {code} {name_display} ...", end=" ", flush=True)

        try:
            bars_inserted, signals_inserted = await _import_one_stock(
                db, client, code, name, ts_code, start_date, end_date
            )
            total_bars += bars_inserted
            total_signals += signals_inserted
            print(f"{bars_inserted} 条日线, {signals_inserted} 个信号")

            if resume:
                completed.add(code)
                save_progress(completed)

        except TushareError as e:
            print(f"失败: {e}")
            logger.warning("tushare_error_for_%s: %s", code, e)
            if "每分钟" in str(e) or "limit" in str(e).lower():
                print("遇到限流，已保存进度。稍后使用 --resume 继续。")
                if resume:
                    save_progress(completed)
            break

        # 数量限制
        if max_stocks > 0:
            newly_imported = idx + 1 - skipped - initial_completed
            if newly_imported >= max_stocks:
                print(f"已达到本轮上限 ({max_stocks} 只)，已保存进度。使用 --resume 继续。")
                if resume:
                    save_progress(completed)
                break

    return total_bars, total_signals, skipped


async def _import_one_stock(
    db: AsyncSession, client, code: str, name: str,
    ts_code: str, start_date: str, end_date: str,
) -> tuple[int, int]:
    """导入单只股票数据，返回 (日线条数, 信号条数)"""

    # 1. 获取日线数据
    df = await client.fetch_daily(ts_code, start_date, end_date)
    if df is None or df.empty:
        return 0, 0

    # 2. 删除该股票的旧信号（MA 会重新计算，信号需重新检测）
    await db.execute(
        text("DELETE FROM pattern_signals WHERE code = :code"),
        {"code": code},
    )

    # 3. 写入 daily_bars（upsert）
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

    # 4. 计算并写入 MA
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

    # 5. 运行形态检测 (需要 >= 120 根 bar)
    if len(all_bars) < 120:
        return bars_inserted, 0

    signals_inserted = 0
    for pid, detector in list_all().items():
        for i in range(120, len(all_bars)):
            if detector.match(_BarsView(all_bars, i + 1)):
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
    return bars_inserted, signals_inserted


async def import_synthetic(db: AsyncSession, force: bool = False):
    """fallback: 使用合成数据（仅当数据库为空或强制重建时）"""
    result = await db.execute(text("SELECT COUNT(*) FROM daily_bars"))
    existing = result.scalar()

    if existing > 0 and not force:
        print(f"数据库已有 {existing} 条日线数据，跳过合成数据生成。")
        print("如需强制重建，请使用 --fallback --clear 参数。")
        return

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
    parser.add_argument("--clear", action="store_true",
                        help="导入前清空全部数据（谨慎使用）")
    parser.add_argument("--max-stocks", type=int, default=0,
                        help="本轮最多导入股票数（0=无限制，适合分批执行）")
    parser.add_argument("--resume", action="store_true",
                        help="从进度文件恢复，跳过已完成的股票")
    parser.add_argument("--codes", nargs="*", default=None,
                        help="仅导入指定股票代码，如: --codes 000001 600519")
    args = parser.parse_args()

    print("=== 炒股学堂 数据导入 ===\n")

    async with async_session() as db:
        if args.fallback:
            await import_synthetic(db, force=args.clear)
            summary = await data_summary()
            print(f"\n完成: {summary}")
            return

        # 检查现有数据
        result = await db.execute(text("SELECT COUNT(*) FROM daily_bars"))
        existing_bars = result.scalar()
        result = await db.execute(text("SELECT COUNT(DISTINCT code) FROM daily_bars"))
        existing_stocks = result.scalar()

        if existing_bars > 0:
            if args.clear:
                print(f"清空现有数据 ({existing_bars} 条日线, {existing_stocks} 只股票)...")
                await clear_existing(db)
                if args.resume and PROGRESS_FILE.exists():
                    PROGRESS_FILE.unlink()
                    print("已清除进度文件")
            else:
                print(f"数据库已有 {existing_bars} 条日线 ({existing_stocks} 只股票)，增量导入...")
                print("(使用 --clear 参数可清空重建)")

        # 确定股票列表
        token = settings.tushare_token
        stocks = None
        if token:
            try:
                client = TushareClient(token)
                stocks = await fetch_stock_list(client, codes=args.codes)
            except TushareError as e:
                print(f"Tushare 初始化失败: {e}")
                if existing_bars == 0 and not args.codes:
                    await import_synthetic(db)
                    summary = await data_summary()
                    print(f"\n完成: {summary}")
                    return
        elif args.codes:
            stocks = [(c, "") for c in args.codes]
        elif existing_bars == 0:
            print("未配置 TUSHARE_TOKEN，使用合成数据...")
            await import_synthetic(db)
            summary = await data_summary()
            print(f"\n完成: {summary}")
            return

        if stocks is None:
            stocks = list(HS300_SAMPLE)

        print(f"待处理: {len(stocks)} 只股票\n")

        # 导入
        try:
            bars, sigs, skipped = await import_from_tushare(
                db, args.days,
                skip_existing=not args.clear,
                stocks=stocks,
                max_stocks=args.max_stocks,
                resume=args.resume,
            )
            print(f"\n[完成] 新增: {bars} 条日线, {sigs} 个信号"
                  + (f", 跳过 {skipped} 只已有数据" if skipped else ""))
        except TushareError as e:
            print(f"\nTushare 不可用: {e}")
            if existing_bars == 0:
                await import_synthetic(db)
            else:
                print(f"数据库已有 {existing_bars} 条数据，跳过合成 fallback。")

    summary = await data_summary()
    print(f"数据库状态: {summary['stocks']} 只股票, "
          f"{summary['total_bars']} 条日线, "
          f"{summary['total_signals']} 个信号")
    print(f"日期范围: {summary['earliest']} ~ {summary['latest']}")


if __name__ == "__main__":
    asyncio.run(main())
