"""股票数据客户端工厂 — 根据配置返回 Baostock 或 Tushare 客户端"""

from ..config import settings
from ..logging import get_logger

logger = get_logger(__name__)


def get_stock_client():
    """返回股票数据客户端实例

    Returns:
        BaostockClient 或 TushareClient（接口一致）
    """
    source = settings.stock_data_source

    if source == "tushare":
        from .tushare_client import TushareClient, TushareError  # noqa: F401
        token = settings.tushare_token
        if not token:
            logger.warning("tushare_token_not_set_falling_back_to_baostock")
            from .baostock_client import BaostockClient
            return BaostockClient()
        return TushareClient(token)

    # 默认 baostock
    from .baostock_client import BaostockClient
    return BaostockClient()
