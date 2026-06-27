"""策略 API 端点"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
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
from ..services.factor_backtest import submit_backtest, get_backtest_status
from ..services.factor_parser import parse_natural_language, ParseError
from ..services.strategy_engine import StrategyEngine
from .errors import AuthError

router = APIRouter(prefix="/strategies", tags=["strategies"])


# ── 因子解析 / 回测 schemas ──

class ParseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500, description="自然语言描述")


class ParseResponse(BaseModel):
    conditions: list[dict]
    explanation: str


class BacktestRequest(BaseModel):
    conditions: list[dict] = Field(..., min_length=1)
    forward_days: int = Field(default=20, ge=5, le=60)


class BacktestSubmitResponse(BaseModel):
    task_id: int
    status: str


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


# ── 因子解析 + 回测端点 ──

@router.post("/parse", response_model=ParseResponse)
async def parse_strategy(body: ParseRequest):
    """将自然语言描述解析为 conditions JSON（few-shot DeepSeek）"""
    try:
        conditions, explanation = await parse_natural_language(body.text)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ParseError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return ParseResponse(conditions=conditions, explanation=explanation)


@router.post("/backtest", response_model=BacktestSubmitResponse, status_code=202)
async def submit_backtest_endpoint(
    body: BacktestRequest,
    db: AsyncSession = Depends(get_db),
):
    """提交异步回测任务，返回 task_id 用于轮询"""
    # 单股预检：验证条件合法性
    from ..models.daily_bar import DailyBar
    from ..services.factor_parser import AVAILABLE_FIELDS, AVAILABLE_OPERATORS

    for cond_dict in body.conditions:
        field = cond_dict.get("field", "")
        operator = cond_dict.get("operator", "")
        if field not in AVAILABLE_FIELDS and field != "pattern":
            raise HTTPException(status_code=422, detail=f"不支持的字段: {field}")
        if operator not in AVAILABLE_OPERATORS:
            raise HTTPException(status_code=422, detail=f"不支持的运算符: {operator}")

    test_code_row = await db.execute(
        select(DailyBar.code).distinct().order_by(DailyBar.code).limit(1)
    )
    test_code = test_code_row.scalar_one_or_none()
    if test_code:
        engine = StrategyEngine(db)
        bars = await engine._load_bars(test_code)
        if len(bars) >= 2:
            try:
                from ..services.strategy_engine import _Condition
                for cond_dict in body.conditions:
                    cond = _Condition(**cond_dict)
                    await engine._check_condition(bars, test_code, cond)
            except Exception as e:
                raise HTTPException(status_code=422, detail=f"条件校验失败: {e}")

    task_id = await submit_backtest(
        conditions=body.conditions,
        forward_days=body.forward_days,
    )
    return BacktestSubmitResponse(task_id=task_id, status="pending")


@router.get("/backtest/{task_id}")
async def poll_backtest(task_id: int):
    """轮询回测任务状态"""
    status = await get_backtest_status(task_id)
    if status is None:
        raise HTTPException(status_code=404, detail=f"回测任务 {task_id} 不存在")
    return status
