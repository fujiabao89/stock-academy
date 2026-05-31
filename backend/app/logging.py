"""structlog 结构化日志 + 请求关联 ID"""

import structlog
import uuid
from fastapi import Request


def setup_logging():
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(*args, **kwargs):
    return structlog.get_logger(*args, **kwargs)


async def correlation_middleware(request: Request, call_next):
    """为每个请求注入 correlation_id"""
    correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4())[:8])
    structlog.contextvars.bind_contextvars(correlation_id=correlation_id)
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = correlation_id
    structlog.contextvars.clear_contextvars()
    return response
