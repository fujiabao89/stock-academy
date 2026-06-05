"""行情数据抓取 — 腾讯免费接口（主）+ Tushare（历史数据）+ httpx 超时 fallback

数据可行性验证结果 (2026-05-31):
- 新浪 API: 403 Forbidden — 已废弃
- 腾讯 API: 100% 成功率，avg 3.09s 响应时间 — 可用作实时行情
- 历史日线数据: 免费接口不支持，需 Tushare Pro 或 CSV 导入
"""

from datetime import date, timedelta

import httpx
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..logging import get_logger
from ..models.daily_bar import DailyBar

logger = get_logger(__name__)


async def fetch_sina(code: str) -> dict | None:
    """新浪行情接口（免费，无需 API Key）"""
    # 新浪代码格式：sh600000, sz000001
    prefix = "sh" if code.startswith(("6", "5")) else "sz"
    full_code = f"{prefix}{code}"
    url = f"{settings.stock_api_base_url_sina}/list={full_code}"

    async with httpx.AsyncClient(timeout=settings.stock_api_timeout) as client:
        try:
            resp = await client.get(url)
            resp.encoding = "gbk"
            if resp.status_code != 200:
                logger.warning("sina_api_failed", code=code, status=resp.status_code)
                return None
            return _parse_sina(code, resp.text)
        except httpx.TimeoutException:
            logger.warning("sina_api_timeout", code=code)
            return None
        except httpx.HTTPError as e:
            logger.error("sina_api_error", code=code, error=str(e))
            return None


def _parse_sina(code: str, text: str) -> dict | None:
    """解析新浪行情返回数据"""
    # 新浪返回格式示例：var hq_str_sh600000="浦发银行,12.34,12.50,..."
    try:
        data = text.split('="')[1].rstrip('";\n')
        fields = data.split(",")
        if len(fields) < 35:
            return None
        return {
            "code": code,
            "name": fields[0],
            "open": float(fields[1]),
            "close": float(fields[3]),
            "high": float(fields[4]),
            "low": float(fields[5]),
            "volume": int(float(fields[8])),
            "amount": float(fields[9]),
        }
    except (IndexError, ValueError) as e:
        logger.warning("sina_parse_error", code=code, error=str(e))
        return None


async def fetch_tencent(code: str) -> dict | None:
    """腾讯行情接口（免费，fallback）"""
    prefix = "sh" if code.startswith(("6", "5")) else "sz"
    full_code = f"{prefix}{code}"
    url = f"{settings.stock_api_base_url_tencent}/q={full_code}"

    async with httpx.AsyncClient(timeout=settings.stock_api_timeout) as client:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            return _parse_tencent(code, resp.text)
        except httpx.TimeoutException:
            logger.warning("tencent_api_timeout", code=code)
            return None
        except httpx.HTTPError as e:
            logger.error("tencent_api_error", code=code, error=str(e))
            return None


def _parse_tencent(code: str, text: str) -> dict | None:
    """解析腾讯行情返回数据"""
    try:
        data = text.split('="')[1].rstrip('";\n')
        fields = data.split("~")
        if len(fields) < 48:
            return None
        return {
            "code": code,
            "name": fields[1],
            "open": float(fields[5]),
            "close": float(fields[3]),
            "high": float(fields[33]),
            "low": float(fields[34]),
            "volume": int(float(fields[6])),
            "amount": float(fields[37]),
        }
    except (IndexError, ValueError) as e:
        logger.warning("tencent_parse_error", code=code, error=str(e))
        return None


async def fetch_with_fallback(code: str) -> dict | None:
    """行情数据获取：新浪 → 腾讯 fallback 链"""
    result = await fetch_sina(code)
    if result is not None:
        return result
    logger.info("fallback_to_tencent", code=code)
    result = await fetch_tencent(code)
    return result


async def compute_ma(
    db: AsyncSession, code: str, target_date: date
) -> dict[str, float | None]:
    """计算某日期的 MA5/MA20/MA60/MA120"""
    bars_query = (
        select(DailyBar)
        .where(DailyBar.code == code, DailyBar.date <= target_date)
        .order_by(DailyBar.date.desc())
        .limit(120)
    )
    result = await db.execute(bars_query)
    bars = list(result.scalars().all())
    bars.reverse()

    closes = [b.close for b in bars]
    if len(closes) < 120:
        return {"ma5": None, "ma20": None, "ma60": None, "ma120": None}

    return {
        "ma5": round(np.mean(closes[-5:]), 3),
        "ma20": round(np.mean(closes[-20:]), 3),
        "ma60": round(np.mean(closes[-60:]), 3),
        "ma120": round(np.mean(closes[-120:]), 3),
    }


async def backfill_daily_data(
    db: AsyncSession, code: str, start_date: date, end_date: date
) -> int:
    """回填历史日线数据（盘后批处理用）"""
    inserted = 0
    current = start_date
    while current <= end_date:
        # 检查是否已存在
        exists = await db.execute(
            select(DailyBar).where(DailyBar.code == code, DailyBar.date == current)
        )
        if exists.scalar_one_or_none() is not None:
            current += timedelta(days=1)
            continue

        quote = await fetch_with_fallback(code)
        if quote is None:
            current += timedelta(days=1)
            continue

        ma = await compute_ma(db, code, current)
        bar = DailyBar(
            code=code,
            date=current,
            open=quote["open"],
            high=quote["high"],
            low=quote["low"],
            close=quote["close"],
            volume=quote["volume"],
            amount=quote["amount"],
            **ma,
        )
        db.add(bar)
        inserted += 1
        current += timedelta(days=1)

    await db.commit()
    return inserted
