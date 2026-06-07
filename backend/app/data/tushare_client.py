"""Tushare Pro API 客户端封装 — 速率控制、重试、错误处理"""

import asyncio
import time

import pandas as pd

from ..config import settings
from ..logging import get_logger

logger = get_logger(__name__)


class TushareError(Exception):
    """Tushare API 错误"""


class TushareClient:
    """Tushare Pro 数据获取客户端

    使用方式:
        client = TushareClient(settings.tushare_token)
        df = client.fetch_daily("000001.SZ", "20200101", "20260601")
    """

    def __init__(self, token: str):
        if not token:
            raise TushareError("TUSHARE_TOKEN 未配置")
        try:
            import tushare as ts
        except ImportError:
            raise TushareError("tushare 未安装，请运行: pip install tushare")

        ts.set_token(token)
        self._pro = ts.pro_api()
        self._delay = settings.tushare_request_delay
        self._last_call = 0.0

    async def _rate_limit(self):
        """速率控制：确保两次调用间隔 >= delay 秒"""
        elapsed = time.monotonic() - self._last_call
        if elapsed < self._delay:
            await asyncio.sleep(self._delay - elapsed)
        self._last_call = time.monotonic()

    def _retry(self, func, *args, max_retries=3, **kwargs):
        """带重试的 API 调用"""
        last_err = None
        for attempt in range(1, max_retries + 1):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                last_err = e
                msg = str(e)
                if "connection" in msg.lower() or "timeout" in msg.lower():
                    wait = 2 ** attempt
                    logger.warning("tushare_retry", attempt=attempt, wait=wait, error=msg)
                    time.sleep(wait)
                    continue
                if "频率超限" in msg or "rate limit" in msg.lower():
                    wait = 65
                    logger.warning("tushare_rate_limit", attempt=attempt, wait=wait, error=msg)
                    time.sleep(wait)
                    continue
                raise TushareError(f"Tushare API 错误: {msg}") from e

        raise TushareError(f"Tushare API 重试{max_retries}次后仍失败: {last_err}")

    async def fetch_daily(
        self, ts_code: str, start_date: str, end_date: str
    ) -> pd.DataFrame | None:
        """获取单只股票日线数据

        Args:
            ts_code: Tushare 股票代码 (如 "000001.SZ", "600519.SH")
            start_date: 起始日期 "YYYYMMDD"
            end_date: 结束日期 "YYYYMMDD"

        Returns:
            DataFrame (columns: trade_date, open, high, low, close, vol, amount)
            或 None（无数据）
        """
        await self._rate_limit()

        def _call():
            return self._pro.daily(
                ts_code=ts_code,
                start_date=start_date,
                end_date=end_date,
            )

        df = await asyncio.to_thread(self._retry, _call)

        if df is None or df.empty:
            logger.info("tushare_no_data", ts_code=ts_code)
            return None

        # 按日期升序排序
        df = df.sort_values("trade_date").reset_index(drop=True)
        logger.info("tushare_fetched", ts_code=ts_code, rows=len(df))
        return df

    async def fetch_stock_basic(self, market: str = "") -> pd.DataFrame | None:
        """获取股票基本信息

        Args:
            market: 市场筛选 "SH" / "SZ" / "" 全部

        Returns:
            DataFrame (columns: ts_code, symbol, name, area, industry, list_date)
        """
        await self._rate_limit()

        def _call():
            return self._pro.stock_basic(
                exchange=market,
                list_status="L",
                fields="ts_code,symbol,name,area,industry,list_date",
            )

        df = await asyncio.to_thread(self._retry, _call)

        if df is None or df.empty:
            logger.warning("tushare_stock_basic_empty")
            return None

        return df

    @staticmethod
    def to_ts_code(code: str) -> str:
        """本地代码转 Tushare 代码: 600519 → 600519.SH, 000001 → 000001.SZ"""
        if code.startswith(("6", "5", "9")):
            return f"{code}.SH"
        return f"{code}.SZ"
