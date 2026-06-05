"""认证依赖注入"""

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.errors import AuthError
from ..database import get_db
from ..models.user import User
from .jwt import decode_token


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise AuthError(detail="缺少或无效的 Authorization header")

    token = auth_header[7:]
    payload = decode_token(token)
    if payload is None:
        raise AuthError(detail="令牌无效或已过期")
    if payload.get("type") != "access":
        raise AuthError(detail="请使用 access token 访问")

    user_id = payload.get("sub")
    if user_id is None:
        raise AuthError(detail="令牌缺少用户标识")

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise AuthError(detail="用户不存在")

    return user


async def get_optional_user(request: Request, db: AsyncSession = Depends(get_db)) -> User | None:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    result = await db.execute(select(User).where(User.id == int(user_id)))
    return result.scalar_one_or_none()
