"""策略 API 端点"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import get_current_user
from ..database import get_db
from ..models.strategy import Strategy, StrategyRun
from ..models.user import User
from ..schemas.strategy import (
    StrategyCreate,
    StrategyListResponse,
    StrategyOut,
    StrategyRunListResponse,
    StrategyRunOut,
    StrategyScanResponse,
    StrategyUpdate,
)
from ..services.strategy_engine import StrategyEngine
from .errors import AuthError

router = APIRouter(prefix="/strategies", tags=["strategies"])


@router.get("", response_model=StrategyListResponse)
async def list_strategies(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        select(Strategy).order_by(Strategy.is_builtin.desc(), Strategy.id)
    )
    items = list(rows.scalars().all())
    return StrategyListResponse(
        items=[StrategyOut.model_validate(s) for s in items],
        total=len(items),
    )


@router.get("/{strategy_id}", response_model=StrategyOut)
async def get_strategy(strategy_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = row.scalar_one_or_none()
    if not strategy:
        from .errors import NotFoundError
        raise NotFoundError(detail=f"策略 {strategy_id} 不存在")
    return StrategyOut.model_validate(strategy)


@router.post("", response_model=StrategyOut, status_code=201)
async def create_strategy(
    body: StrategyCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    strategy = Strategy(
        name=body.name,
        description=body.description,
        conditions=[c.model_dump() for c in body.conditions],
        is_builtin=False,
    )
    db.add(strategy)
    await db.commit()
    await db.refresh(strategy)
    return StrategyOut.model_validate(strategy)


@router.put("/{strategy_id}", response_model=StrategyOut)
async def update_strategy(
    strategy_id: int,
    body: StrategyUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = row.scalar_one_or_none()
    if not strategy:
        from .errors import NotFoundError
        raise NotFoundError(detail=f"策略 {strategy_id} 不存在")
    if strategy.is_builtin:
        raise HTTPException(status_code=403, detail="内置策略不可修改")

    update = body.model_dump(exclude_unset=True)
    if "conditions" in update:
        update["conditions"] = [c if isinstance(c, dict) else c.model_dump() for c in update["conditions"]]
    for key, val in update.items():
        setattr(strategy, key, val)
    strategy.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(strategy)
    return StrategyOut.model_validate(strategy)


@router.delete("/{strategy_id}", status_code=204)
async def delete_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = row.scalar_one_or_none()
    if not strategy:
        from .errors import NotFoundError
        raise NotFoundError(detail=f"策略 {strategy_id} 不存在")
    if strategy.is_builtin:
        raise HTTPException(status_code=403, detail="内置策略不可删除")

    await db.delete(strategy)
    await db.commit()


@router.post("/{strategy_id}/scan", response_model=StrategyScanResponse)
async def scan_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
):
    row = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = row.scalar_one_or_none()
    if not strategy:
        from .errors import NotFoundError
        raise NotFoundError(detail=f"策略 {strategy_id} 不存在")

    engine = StrategyEngine(db)
    total_scanned, total_matched, runs = await engine.scan(strategy)

    return StrategyScanResponse(
        strategy_id=strategy.id,
        strategy_name=strategy.name,
        scanned_at=datetime.now(timezone.utc),
        total_scanned=total_scanned,
        total_matched=total_matched,
        results=[StrategyRunOut.model_validate(r) for r in runs],
    )


@router.get("/{strategy_id}/runs", response_model=StrategyRunListResponse)
async def get_strategy_runs(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
):
    row = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    if not row.scalar_one_or_none():
        from .errors import NotFoundError
        raise NotFoundError(detail=f"策略 {strategy_id} 不存在")

    runs_row = await db.execute(
        select(StrategyRun)
        .where(StrategyRun.strategy_id == strategy_id)
        .order_by(StrategyRun.matched_at.desc())
    )
    items = list(runs_row.scalars().all())
    return StrategyRunListResponse(
        items=[StrategyRunOut.model_validate(r) for r in items],
        total=len(items),
    )
