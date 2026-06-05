from .auth import router as auth_router
from .errors import register_error_handlers
from .glossary import router as glossary_router
from .news import router as news_router, watchlist_news_router
from .patterns import router as patterns_router
from .signals import router as signals_router
from .stocks import router as stocks_router
from .strategies import router as strategies_router
from .watchlist import router as watchlist_router

__all__ = [
    "auth_router",
    "register_error_handlers",
    "glossary_router",
    "news_router",
    "patterns_router",
    "signals_router",
    "stocks_router",
    "strategies_router",
    "watchlist_news_router",
    "watchlist_router",
]
