"""FastAPI 全局异常处理 — 标准化错误响应格式"""

from fastapi import Request
from fastapi.responses import JSONResponse

from ..schemas.error import ErrorDetail, ErrorResponse


class AppError(Exception):
    """应用级异常基类"""

    def __init__(self, code: str, message: str, detail: str | None = None, status: int = 500):
        self.code = code
        self.message = message
        self.detail = detail
        self.status = status


class DataFetchError(AppError):
    def __init__(self, detail: str | None = None):
        super().__init__(
            code="DATA_FETCH_FAILED",
            message="行情数据获取失败",
            detail=detail,
            status=502,
        )


class PatternError(AppError):
    def __init__(self, detail: str | None = None):
        super().__init__(
            code="PATTERN_ERROR",
            message="形态匹配异常",
            detail=detail,
            status=500,
        )


class NotFoundError(AppError):
    def __init__(self, detail: str | None = None):
        super().__init__(
            code="NOT_FOUND",
            message="请求的资源不存在",
            detail=detail,
            status=404,
        )


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content=ErrorResponse(
            error=ErrorDetail(code=exc.code, message=exc.message, detail=exc.detail)
        ).model_dump(),
    )


def register_error_handlers(app):
    app.add_exception_handler(AppError, app_error_handler)
