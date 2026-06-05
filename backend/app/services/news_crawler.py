"""新闻爬虫 — 新浪财经 API + Tushare 备用 + 股票代码匹配 + URL 去重"""

import json
import re
import time
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..logging import get_logger
from ..models.news import NewsArticle
from ..stock_names import _NAME_TO_CODE

logger = get_logger(__name__)

SINA_BASE = "https://feed.mix.sina.com.cn/api/roll/get"
SINA_LID = "2509"

_STOCK_CODE_RE = re.compile(r"\b(0[0123]\d{4}|3[0-9]\d{3}|6[012]\d{3})\b")


def _extract_stock_codes(title: str, intro: str) -> list[str]:
    """从标题+摘要中提取股票代码 — 正则匹配 + 名称倒查"""
    text = f"{title} {intro}"
    codes: set[str] = set()

    for name, code in _NAME_TO_CODE.items():
        if name in text:
            codes.add(code)

    codes.update(_STOCK_CODE_RE.findall(text))
    return sorted(codes)


class NewsCrawler:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def fetch_sina(self) -> list[dict]:
        """从新浪财经抓取 A 股新闻"""
        url = f"{SINA_BASE}?pageid=153&lid={SINA_LID}&num={settings.news_max_per_crawl}&r={time.time()}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    url,
                    headers={"User-Agent": "stock-academy/0.1"},
                )
                resp.raise_for_status()
                data = resp.json()
                return data.get("result", {}).get("data", [])
        except Exception as exc:
            logger.error("新浪新闻抓取失败", error=str(exc)[:200])
            return []

    async def crawl(self) -> list[NewsArticle]:
        """执行一轮抓取，返回新保存的文章"""
        raw_items = await self.fetch_sina()
        if not raw_items:
            return []

        saved: list[NewsArticle] = []
        for item in raw_items:
            url = item.get("url", "")
            if not url:
                continue

            exists = await self.db.execute(
                select(NewsArticle.id).where(NewsArticle.url == url)
            )
            if exists.scalar_one_or_none() is not None:
                continue

            title = item.get("title", "")
            intro = item.get("intro", "")
            codes = _extract_stock_codes(title, intro)

            ts = item.get("ctime") or item.get("mtime") or 0
            published_at = datetime.fromtimestamp(int(ts), tz=timezone.utc)

            article = NewsArticle(
                title=title,
                url=url,
                source="sina",
                content_summary=intro[:200] if intro else "",
                published_at=published_at,
                stock_codes=codes,
            )
            self.db.add(article)
            saved.append(article)

        if saved:
            await self.db.commit()
            logger.info("新闻抓取完成", new=len(saved))

        return saved
