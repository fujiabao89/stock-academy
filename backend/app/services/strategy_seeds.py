"""内置策略种子数据 — 在 lifespan 启动时自动创建"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..logging import get_logger
from ..models.strategy import Strategy

logger = get_logger(__name__)

BUILTIN_STRATEGIES: list[dict] = [
    {
        "name": "均线多头+放量",
        "description": "MA5>MA20>MA60 多头排列，且成交量突破 1.5 倍 20 日均量",
        "conditions": [
            {"field": "ma5", "operator": "gt", "field2": "ma20"},
            {"field": "ma20", "operator": "gt", "field2": "ma60"},
            {"field": "volume_ratio_20", "operator": "gt", "value": 1.5},
        ],
        "is_builtin": True,
    },
    {
        "name": "金叉买入信号",
        "description": "MA5 上穿 MA20，短期趋势转强",
        "conditions": [
            {"field": "ma5", "operator": "cross_above", "field2": "ma20"},
        ],
        "is_builtin": True,
    },
    {
        "name": "放量突破前高",
        "description": "收盘价突破 20 日最高价且成交量放大至 2 倍均量",
        "conditions": [
            {"field": "close", "operator": "gt", "field2": "high_20"},
            {"field": "volume_ratio_20", "operator": "gt", "value": 2.0},
        ],
        "is_builtin": True,
    },
    {
        "name": "底部反转形态",
        "description": "超跌区域（收盘<MA60）出现锤子线形态",
        "conditions": [
            {"field": "close", "operator": "lt", "field2": "ma60"},
            {"field": "pattern", "operator": "pattern", "pattern_id": "hammer"},
        ],
        "is_builtin": True,
    },
    {
        "name": "均线粘合突破",
        "description": "MA5/MA20/MA60 多头排列且收盘站上所有均线",
        "conditions": [
            {"field": "close", "operator": "gt", "field2": "ma5"},
            {"field": "ma5", "operator": "gt", "field2": "ma20"},
            {"field": "ma20", "operator": "gt", "field2": "ma60"},
        ],
        "is_builtin": True,
    },
]


async def seed_builtin_strategies(db: AsyncSession) -> None:
    existing = await db.execute(
        select(Strategy.id).where(Strategy.is_builtin == True)
    )
    if existing.first() is not None:
        return

    for item in BUILTIN_STRATEGIES:
        strategy = Strategy(**item)
        db.add(strategy)

    await db.commit()
    logger.info("内置策略已创建", count=len(BUILTIN_STRATEGIES))
