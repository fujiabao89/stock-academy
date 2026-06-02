"""FastAPI 应用入口"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import glossary_router, patterns_router, register_error_handlers, signals_router, stocks_router
from .config import settings
from .logging import correlation_middleware, get_logger, setup_logging

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("stock-academy starting", environment=settings.environment)
    yield
    logger.info("stock-academy shutting down")


app = FastAPI(
    title="炒股学堂 API",
    description="不推荐股票，只教判断方法 — A股教学工具",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# 中间件
app.middleware("http")(correlation_middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 异常处理
register_error_handlers(app)

# 路由
app.include_router(stocks_router, prefix="/api")
app.include_router(patterns_router, prefix="/api")
app.include_router(signals_router, prefix="/api")
app.include_router(glossary_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": settings.app_name}


# 生产模式：托管前端静态文件（SPA）
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
