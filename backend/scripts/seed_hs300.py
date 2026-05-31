"""种子数据脚本：预填 30 只沪深300 成分股历史日线数据

优先级：
1. Tushare Pro（如配置了 token）— 获取完整历史数据
2. 新浪/腾讯免费接口 — 仅当日行情，需多次运行积累
3. CSV 文件 — 手动导入

运行方式：docker compose exec backend python scripts/seed_hs300.py
"""

import asyncio
import csv
import os
import sys
from datetime import date, timedelta
from pathlib import Path

# 添加项目根目录到 sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
import numpy as np
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.models.daily_bar import DailyBar

# 30 只沪深300 成分股（覆盖不同行业和市值区间）
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


async def fetch_historical_from_csv(filepath: str) -> int:
    """从 CSV 文件导入历史日线数据"""
    inserted = 0
    async with async_session() as db:
        with open(filepath, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                bar_date = date.fromisoformat(row["date"])
                exists = await db.execute(
                    select(DailyBar).where(
                        DailyBar.code == row["code"], DailyBar.date == bar_date
                    )
                )
                if exists.scalar_one_or_none() is not None:
                    continue
                bar = DailyBar(
                    code=row["code"],
                    date=bar_date,
                    open=float(row["open"]),
                    high=float(row["high"]),
                    low=float(row["low"]),
                    close=float(row["close"]),
                    volume=int(row["volume"]),
                    amount=float(row["amount"]),
                    ma5=float(row["ma5"]) if row.get("ma5") else None,
                    ma20=float(row["ma20"]) if row.get("ma20") else None,
                    ma60=float(row["ma60"]) if row.get("ma60") else None,
                    ma120=float(row["ma120"]) if row.get("ma120") else None,
                )
                db.add(bar)
                inserted += 1
        await db.commit()
    return inserted


async def compute_and_update_ma(db: AsyncSession, code: str):
    """为某只股票计算并更新均线值"""
    bars_query = (
        select(DailyBar)
        .where(DailyBar.code == code)
        .order_by(DailyBar.date.asc())
    )
    result = await db.execute(bars_query)
    bars = list(result.scalars().all())

    closes = [b.close for b in bars]
    for i in range(len(bars)):
        bar = bars[i]
        if i >= 4:
            bar.ma5 = round(np.mean(closes[i - 4 : i + 1]), 3)
        if i >= 19:
            bar.ma20 = round(np.mean(closes[i - 19 : i + 1]), 3)
        if i >= 59:
            bar.ma60 = round(np.mean(closes[i - 59 : i + 1]), 3)
        if i >= 119:
            bar.ma120 = round(np.mean(closes[i - 119 : i + 1]), 3)

    await db.commit()


async def try_tushare_fetch() -> int:
    """尝试通过 Tushare Pro 接口获取历史数据"""
    token = os.getenv("TUSHARE_TOKEN")
    if not token:
        return 0

    try:
        import tushare as ts
    except ImportError:
        print("tushare 未安装，跳过")
        return 0

    ts.set_token(token)
    pro = ts.pro_api()
    inserted = 0
    today = date.today()

    async with async_session() as db:
        for code, name in HS300_SAMPLE:
            full_code = f"{code}.SZ" if code.startswith(("0", "3")) else f"{code}.SH"
            try:
                df = pro.daily(
                    ts_code=full_code,
                    start_date=(today - timedelta(days=settings.backtest_years * 365)).strftime("%Y%m%d"),
                    end_date=today.strftime("%Y%m%d"),
                )
            except Exception as e:
                print(f"  {code} {name} 获取失败: {e}")
                continue

            if df is None or df.empty:
                print(f"  {code} {name} 无数据")
                continue

            for _, row in df.iterrows():
                bar_date = date.fromisoformat(str(row["trade_date"]))
                # 检查重复
                exists = await db.execute(
                    select(DailyBar).where(
                        DailyBar.code == code, DailyBar.date == bar_date
                    )
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
                    amount=float(row["amount"]) if row.get("amount") else 0.0,
                )
                db.add(bar)
                inserted += 1

            await db.commit()
            print(f"  {code} {name}: {inserted} 条已插入")

    async with async_session() as db:
        for code, _ in HS300_SAMPLE:
            await compute_and_update_ma(db, code)

    return inserted


async def data_summary() -> dict:
    """输出当前数据库中的数据概览"""
    async with async_session() as db:
        result = await db.execute(text("SELECT COUNT(*) FROM daily_bars"))
        total = result.scalar()
        result = await db.execute(
            text("SELECT COUNT(DISTINCT code) FROM daily_bars")
        )
        stocks = result.scalar()
        result = await db.execute(
            text("SELECT MIN(date), MAX(date) FROM daily_bars")
        )
        row = result.fetchone()
        return {"total_bars": total, "stocks": stocks, "earliest": row[0], "latest": row[1]}


async def main():
    print("=== 炒股学堂 种子数据填充 ===\n")

    # 1. 尝试通过 Tushare 获取
    print("[1] 尝试 Tushare Pro...")
    ts_inserted = await try_tushare_fetch()
    if ts_inserted > 0:
        print(f"\nTushare 导入完成：{ts_inserted} 条")
        summary = await data_summary()
        print(f"数据库状态：{summary}")
        return

    # 2. 检查是否有 CSV 文件
    csv_path = Path(__file__).parent / "hs300_sample.csv"
    if csv_path.exists():
        print(f"\n[2] 从 CSV 导入: {csv_path}")
        csv_inserted = await fetch_historical_from_csv(str(csv_path))
        print(f"CSV 导入完成：{csv_inserted} 条")
        summary = await data_summary()
        print(f"数据库状态：{summary}")
        return

    # 3. 无数据源可用
    print("\n[!] 无可用数据源")
    print("    选项 1: 设置 TUSHARE_TOKEN 环境变量")
    print("    选项 2: 将 CSV 文件放到 backend/scripts/hs300_sample.csv")
    print("    选项 3: 运行 backend/app/data/fetch.py 从免费接口增量拉取")
    print("\n    CSV 格式：code,date,open,high,low,close,volume,amount")


if __name__ == "__main__":
    asyncio.run(main())
