"""Baostock 数据客户端 — 免费无限流 A 股日线数据

使用方式:
    client = BaostockClient()
    df = await client.fetch_daily("sh.600519", "20200101", "20260601")
    # 用完记得登出:
    await client.close()
"""

import asyncio
from datetime import date

import pandas as pd

from ..logging import get_logger

logger = get_logger(__name__)


class BaostockError(Exception):
    """Baostock API 错误"""


class BaostockClient:
    """Baostock 数据获取客户端

    接口与 TushareClient 对齐，内部用 asyncio.to_thread 包装同步调用。

    代码格式:
        Baostock 使用 sh.600519 / sz.000001 格式
        Tushare 使用 600519.SH / 000001.SZ 格式
        本客户端统一对外暴露 Baostock 格式，提供 to_bs_code() 静态方法做转换
    """

    def __init__(self):
        self._logged_in = False

    async def _ensure_login(self):
        """确保已登录（自动登录）"""
        if self._logged_in:
            return

        def _login():
            import baostock as bs
            lg = bs.login()
            if lg.error_code != "0":
                raise BaostockError(f"Baostock 登录失败: {lg.error_msg}")
            return lg

        await asyncio.to_thread(_login)
        self._logged_in = True
        logger.info("baostock_login_success")

    async def close(self):
        """登出释放资源"""
        if not self._logged_in:
            return

        def _logout():
            import baostock as bs
            bs.logout()

        await asyncio.to_thread(_logout)
        self._logged_in = False

    async def fetch_daily(
        self, bs_code: str, start_date: str, end_date: str
    ) -> pd.DataFrame | None:
        """获取单只股票日线数据

        Args:
            bs_code: Baostock 股票代码 (如 "sh.600519", "sz.000001")
            start_date: 起始日期 "YYYY-MM-DD" 或 "YYYYMMDD"
            end_date: 结束日期 "YYYY-MM-DD" 或 "YYYYMMDD"

        Returns:
            DataFrame (columns: trade_date, open, high, low, close, volume, amount)
            或 None（无数据）
        """
        await self._ensure_login()

        # 统一日期格式为 YYYY-MM-DD（Baostock 要求）
        start = _normalize_date(start_date)
        end = _normalize_date(end_date)

        def _call():
            import baostock as bs
            rs = bs.query_history_k_data_plus(
                bs_code,
                "date,open,high,low,close,volume,amount",
                start_date=start,
                end_date=end,
                frequency="d",
                adjustflag="2",  # 前复权
            )
            if rs.error_code != "0":
                raise BaostockError(f"Baostock 查询失败: {rs.error_msg}")

            rows = []
            while rs.next():
                rows.append(rs.get_row_data())

            if not rows:
                return None

            df = pd.DataFrame(rows, columns=["date", "open", "high", "low", "close", "volume", "amount"])
            # 转换类型
            for col in ["open", "high", "low", "close"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0).astype("int64")
            df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0)
            # 统一列名为 trade_date（与 Tushare 对齐）
            df.rename(columns={"date": "trade_date"}, inplace=True)
            # 转换日期格式: 2020-01-01 → 20200101
            df["trade_date"] = df["trade_date"].str.replace("-", "")
            return df

        df = await asyncio.to_thread(_call)

        if df is None or df.empty:
            logger.info("baostock_no_data", bs_code=bs_code)
            return None

        df = df.sort_values("trade_date").reset_index(drop=True)
        logger.info("baostock_fetched", bs_code=bs_code, rows=len(df))
        return df

    async def fetch_stock_basic(self) -> pd.DataFrame | None:
        """获取全市场股票基本信息

        Returns:
            DataFrame (columns: code, name, ipo_date)
            或 None
        """
        await self._ensure_login()

        def _call():
            import baostock as bs
            rs = bs.query_stock_basic()
            if rs.error_code != "0":
                raise BaostockError(f"Baostock 查询股票列表失败: {rs.error_msg}")

            rows = []
            while rs.next():
                row = rs.get_row_data()
                # row: [code, code_name, ipoDate, outDate, type, status]
                if row[5] == "1":  # 只取上市状态
                    rows.append(row)

            if not rows:
                return None

            df = pd.DataFrame(rows, columns=["code", "name", "ipo_date", "out_date", "type", "status"])
            return df[["code", "name", "ipo_date"]]

        return await asyncio.to_thread(_call)

    @staticmethod
    def to_bs_code(code: str) -> str:
        """本地代码转 Baostock 代码: 600519 → sh.600519, 000001 → sz.000001"""
        if code.startswith(("6", "5", "9")):
            return f"sh.{code}"
        return f"sz.{code}"


def _normalize_date(date_str: str) -> str:
    """将 YYYYMMDD 或 YYYY-MM-DD 统一为 YYYY-MM-DD"""
    clean = date_str.replace("-", "")
    if len(clean) == 8:
        return f"{clean[:4]}-{clean[4:6]}-{clean[6:8]}"
    return date_str
