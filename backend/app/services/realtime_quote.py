"""实时行情 — 新浪财经 API 代理"""

import re
from dataclasses import dataclass

import httpx

from ..logging import get_logger

logger = get_logger(__name__)

SINA_URL = "http://hq.sinajs.cn/list="

# 新浪市场前缀映射
_MARKET_PREFIX = {
    "sh": "sh",
    "sz": "sz",
    "bj": "bj",
}


@dataclass
class RealtimeQuote:
    name: str
    open: float
    prev_close: float
    current: float
    high: float
    low: float
    volume: int
    amount: float
    date: str  # YYYY-MM-DD
    time: str  # HH:MM:SS
    change: float
    change_pct: float


def _market(code: str) -> str:
    if code.startswith("6"):
        return "sh"
    elif code.startswith(("0", "3")):
        return "sz"
    elif code.startswith(("4", "8")):
        return "bj"
    return "sz"


async def fetch_realtime(code: str) -> RealtimeQuote | None:
    """获取单只股票实时行情"""
    prefix = _market(code)
    url = f"{SINA_URL}{prefix}{code}"

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(url, headers={"Referer": "https://finance.sina.com.cn"})
    except Exception as exc:
        logger.debug("新浪行情请求失败", code=code, error=str(exc)[:100])
        return None

    if resp.status_code != 200:
        return None

    text = resp.text.strip()
    if not text:
        return None

    # 解析 var hq_str_sh600519="字段1,字段2,..."
    m = re.search(r'"([^"]*)"', text)
    if not m:
        return None

    fields = m.group(1).split(",")
    if len(fields) < 32:
        return None

    try:
        name = fields[0]
        open_price = float(fields[1])
        prev_close = float(fields[2])
        current = float(fields[3])
        high = float(fields[4])
        low = float(fields[5])
        volume = int(float(fields[8]))
        amount = float(fields[9])
        date_str = fields[30]  # YYYY-MM-DD
        raw_time = fields[31]  # HH:MM:SS
        change = round(current - prev_close, 2)
        change_pct = round(change / prev_close * 100, 2) if prev_close != 0 else 0.0

        return RealtimeQuote(
            name=name,
            open=open_price,
            prev_close=prev_close,
            current=current,
            high=high,
            low=low,
            volume=volume,
            amount=amount,
            date=date_str,
            time=raw_time,
            change=change,
            change_pct=change_pct,
        )
    except (ValueError, IndexError) as exc:
        logger.debug("新浪行情解析失败", code=code, error=str(exc)[:100])
        return None
