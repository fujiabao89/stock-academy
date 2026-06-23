"""新闻调度器 — APScheduler 每 30 分钟触发爬虫 + AI 管道"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from ..config import settings
from ..database import async_session
from ..logging import get_logger
from .ai_summarizer import AISummarizer
from .news_crawler import NewsCrawler

logger = get_logger(__name__)

scheduler: AsyncIOScheduler | None = None


async def _run_pipeline() -> None:
    """执行一轮新闻抓取 + AI 解读管道"""
    logger.info("新闻管道开始")
    try:
        async with async_session() as db:
            crawler = NewsCrawler(db)
            new_articles = await crawler.crawl()

            if new_articles:
                summarizer = AISummarizer(db)
                await summarizer.summarize_batch(new_articles)

        logger.info("新闻管道完成")
    except Exception as exc:
        logger.error("新闻管道异常", error=str(exc)[:200])


async def start_scheduler() -> None:
    global scheduler
    from .daily_bar_updater import _update_all_stocks

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _run_pipeline,
        "interval",
        minutes=settings.news_crawl_interval_minutes,
        id="news_pipeline",
        replace_existing=True,
    )
    # 每个交易日下午 17:00 更新日线数据
    scheduler.add_job(
        _update_all_stocks,
        "cron",
        day_of_week="mon-fri",
        hour=17,
        minute=0,
        id="daily_kline_update",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("新闻调度器已启动", interval_minutes=settings.news_crawl_interval_minutes)


async def stop_scheduler() -> None:
    global scheduler
    if scheduler:
        scheduler.shutdown(wait=False)
        scheduler = None
        logger.info("新闻调度器已停止")
