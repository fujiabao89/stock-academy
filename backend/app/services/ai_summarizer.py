"""AI 摘要服务 — DeepSeek API 批处理：一句话摘要 + 情绪标签"""

import json
import re
import time as _time

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..logging import get_logger
from ..models.news import NewsArticle

logger = get_logger(__name__)

SYSTEM_PROMPT = (
    "你是炒股学堂的AI助手，任务是对财经新闻做白话解读。"
    "对每条新闻输出两行：第一行是一句话大白话摘要（50字以内），"
    "第二行是情绪标签，只能是 利好、利空 或 中性 三个词之一。"
    "用 JSON 数组格式回复，每个元素是 {\"summary\": \"...\", \"sentiment\": \"...\"}。"
    "不要包含任何其他文字。"
)

_daily_count = 0
_daily_reset_at = _time.monotonic()
_minute_hits: list[float] = []


def _check_limits() -> bool:
    """检查速率限制和日限额，返回 True 表示可以继续"""
    global _daily_count, _daily_reset_at
    now = _time.monotonic()

    if now - _daily_reset_at > 86400:
        _daily_count = 0
        _daily_reset_at = now

    if _daily_count >= settings.deepseek_daily_limit:
        logger.warning("AI 摘要日限额已达上限", limit=settings.deepseek_daily_limit)
        return False

    cutoff = now - 60
    while _minute_hits and _minute_hits[0] < cutoff:
        _minute_hits.pop(0)

    if len(_minute_hits) >= settings.deepseek_rate_per_minute:
        logger.info("AI 摘要速率限制等待中", hits=len(_minute_hits))
        return False

    _minute_hits.append(now)
    _daily_count += 1
    return True


class AISummarizer:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def summarize_batch(self, articles: list[NewsArticle]) -> int:
        """批量对新闻做 AI 解读，返回成功处理的数量"""
        if not articles:
            return 0

        processed = 0
        batch_size = settings.deepseek_batch_size

        for i in range(0, len(articles), batch_size):
            batch = articles[i : i + batch_size]
            if not _check_limits():
                break

            try:
                results = await self._call_deepseek(batch)
                await self._save_results(batch, results)
                processed += len(results)
            except Exception as exc:
                logger.error("AI 摘要 API 调用失败", error=str(exc)[:200])
                break

        if processed:
            await self.db.commit()
            logger.info("AI 摘要处理完成", processed=processed)

        return processed

    async def summarize_unsynced(self) -> int:
        """查找所有未 AI 解读的文章并处理"""
        result = await self.db.execute(
            select(NewsArticle)
            .where(NewsArticle.ai_summary.is_(None))
            .order_by(NewsArticle.published_at.desc())
            .limit(settings.deepseek_daily_limit)
        )
        articles = result.scalars().all()
        return await self.summarize_batch(list(articles))

    async def _call_deepseek(self, articles: list[NewsArticle]) -> list[dict]:
        """调用 DeepSeek API 进行批量解读"""
        items = [
            f"新闻{i + 1}：{a.title}\n内容：{a.content_summary}"
            for i, a in enumerate(articles)
        ]
        user_msg = "\n\n".join(items)

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.deepseek_base_url}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.deepseek_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.deepseek_model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_msg},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 2048,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["choices"][0]["message"]["content"]
        return _parse_batch_response(content)

    async def _save_results(self, articles: list[NewsArticle], results: list[dict]) -> None:
        for article, result in zip(articles, results):
            article.ai_summary = result.get("summary")
            article.sentiment = result.get("sentiment")
            self.db.add(article)


def _parse_batch_response(content: str) -> list[dict]:
    """解析 DeepSeek 返回的 JSON 数组"""
    try:
        parsed = json.loads(content)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    # 尝试提取 JSON 数组
    match = re.search(r"\[.*\]", content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return []
