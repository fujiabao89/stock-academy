"""股票相关 API 端点"""

from fastapi import APIRouter, HTTPException, Query

from ..schemas.stock import KlineItem, StockOverview, StockSearchResult

router = APIRouter(prefix="/stocks", tags=["stocks"])


# 股票名称-代码映射表（MVP 阶段手维护沪深300，后续扩展为数据库查询）
_STOCK_MAP: dict[str, dict] = {}


def load_stock_map():
    """从数据库加载股票映射（应用启动时调用）"""
    global _STOCK_MAP
    # TODO: 从 PostgreSQL 加载
    _STOCK_MAP = {}


@router.get("/search", response_model=list[StockSearchResult])
async def search_stocks(q: str = Query(..., min_length=1, description="搜索关键词（代码/名称）")):
    """搜索股票，支持代码和名称模糊匹配"""
    q_upper = q.upper().strip()
    results = []
    for code, info in _STOCK_MAP.items():
        if q_upper in code or q_upper in info.get("name", "").upper():
            results.append(
                StockSearchResult(code=code, name=info["name"], market=info.get("market", "sz"))
            )
    if not results:
        return []
    return results[:20]


@router.get("/{code}/overview", response_model=StockOverview)
async def get_stock_overview(code: str):
    """个股概览（最新价、涨跌幅、基本信息）"""
    # TODO: 从 PostgreSQL 查询最新日线数据
    raise HTTPException(status_code=501, detail="功能开发中")


@router.get("/{code}/kline", response_model=list[KlineItem])
async def get_stock_kline(code: str, period: str = Query("d", pattern="^(d|w|m)$")):
    """K线数据（含均线），period: d=日K, w=周K, m=月K"""
    # TODO: 从 PostgreSQL 查询
    raise HTTPException(status_code=501, detail="功能开发中")


@router.get("/{code}/signals")
async def get_stock_signals(code: str):
    """当前触发的所有形态信号列表"""
    # TODO: 从 pattern_signals 表查询
    raise HTTPException(status_code=501, detail="功能开发中")
