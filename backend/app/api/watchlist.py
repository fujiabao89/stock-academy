"""自选股 API 端点"""

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import get_current_user
from ..database import get_db
from ..models.user import User
from ..models.watchlist import WatchlistItem
from ..schemas.watchlist import WatchlistItemOut, WatchlistResponse
from ..stock_names import stock_info
from .errors import AppError, NotFoundError

router = APIRouter(prefix="/user/watchlist", tags=["watchlist"])


@router.get("", response_model=WatchlistResponse)
async def get_watchlist(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WatchlistItem)
        .where(WatchlistItem.user_id == current_user.id)
        .order_by(WatchlistItem.added_at.desc())
    )
    items = result.scalars().all()

    out: list[WatchlistItemOut] = []
    for item in items:
        info = stock_info(item.stock_code)
        name = info[0] if info else item.stock_code
        market = info[1] if info else "unknown"
        out.append(
            WatchlistItemOut(
                code=item.stock_code,
                name=name,
                market=market,
                added_at=item.added_at,
            )
        )

    return WatchlistResponse(items=out, count=len(out))


@router.post("/{code}", status_code=201, response_model=WatchlistItemOut)
async def add_watchlist(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    info = stock_info(code)
    if info is None:
        raise NotFoundError(detail=f"未知股票代码: {code}")

    existing = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.user_id == current_user.id,
            WatchlistItem.stock_code == code,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise AppError(
            code="DUPLICATE",
            message="该股票已在自选列表中",
            status=409,
        )

    item = WatchlistItem(user_id=current_user.id, stock_code=code)
    db.add(item)
    await db.commit()
    await db.refresh(item)

    return WatchlistItemOut(
        code=item.stock_code,
        name=info[0],
        market=info[1],
        added_at=item.added_at,
    )


@router.delete("/{code}", status_code=204)
async def remove_watchlist(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(WatchlistItem).where(
            WatchlistItem.user_id == current_user.id,
            WatchlistItem.stock_code == code,
        )
    )
    if result.rowcount == 0:
        raise NotFoundError(detail="自选列表中未找到该股票")

    await db.commit()
    return None
