"""FastAPI 应用入口"""

import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .api import auth_router, glossary_router, news_router, patterns_router, register_error_handlers, signals_router, stocks_router, watchlist_news_router, watchlist_router
from .config import settings
from .logging import correlation_middleware, get_logger, setup_logging
from .services.news_scheduler import start_scheduler, stop_scheduler

logger = get_logger(__name__)

# ---------- 速率限制中间件 ----------

_WINDOW = 60          # 窗口：60 秒
_MAX_REQUESTS = 30    # 每窗口最多请求数（默认值，可被 config 覆盖）
_hits: dict[str, list[float]] = defaultdict(list)
_skip_prefixes = ("/docs", "/redoc", "/openapi.json", "/static")


async def rate_limit_middleware(request: Request, call_next):
    path = request.url.path
    if path.startswith(_skip_prefixes):
        return await call_next(request)

    if not settings.rate_limit_enabled:
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window = _hits[client_ip]

    # 清理过期记录
    cutoff = now - _WINDOW
    while window and window[0] < cutoff:
        window.pop(0)

    if len(window) >= _MAX_REQUESTS:
        retry_after = int(window[0] + _WINDOW - now) + 1
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": "RATE_LIMITED",
                    "message": "请求过于频繁，请稍后重试",
                    "detail": f"每 {_WINDOW} 秒最多 {_MAX_REQUESTS} 次请求，请在 {retry_after} 秒后重试",
                }
            },
            headers={"Retry-After": str(retry_after)},
        )

    window.append(now)
    return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("stock-academy starting", environment=settings.environment)
    await start_scheduler()
    yield
    await stop_scheduler()
    logger.info("stock-academy shutting down")


app = FastAPI(
    title="炒股学堂 API",
    description="不推荐股票，只教判断方法 — A股教学工具",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# 中间件 — 顺序敏感：后添加的先执行
app.middleware("http")(correlation_middleware)
app.middleware("http")(rate_limit_middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 异常处理
register_error_handlers(app)

# 路由
app.include_router(auth_router, prefix="/api")
app.include_router(stocks_router, prefix="/api")
app.include_router(patterns_router, prefix="/api")
app.include_router(signals_router, prefix="/api")
app.include_router(glossary_router, prefix="/api")
app.include_router(watchlist_router, prefix="/api")
app.include_router(news_router, prefix="/api")
app.include_router(watchlist_news_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": settings.app_name}


# 生产模式：托管前端静态文件（SPA）
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
