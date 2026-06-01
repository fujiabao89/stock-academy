#!/bin/bash
set -e

echo "[start] 检查数据库状态..."
python -c "
import asyncio, sys
sys.path.insert(0, '.')
from app.database import Base, engine, async_session
from app.models import DailyBar, PatternSignal  # 触发模型注册
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session() as db:
        result = await db.execute(text('SELECT COUNT(*) FROM daily_bars'))
        count = result.scalar()
    print(f'[start] 已有 {count} 条数据')
    if count == 0:
        print('[start] 数据库为空，生成种子数据...')
        from scripts.generate_synthetic_data import main as seed_main
        await seed_main()

asyncio.run(main())
" 2>&1

echo "[start] 启动服务..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
