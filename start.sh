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
        bar_count = await db.execute(text('SELECT COUNT(*) FROM daily_bars'))
        bar_count = bar_count.scalar()
        sig_count = await db.execute(text('SELECT COUNT(*) FROM pattern_signals'))
        sig_count = sig_count.scalar()
    print(f'[start] 已有 {bar_count} 条日线数据, {sig_count} 条形态信号')
    need_seed = bar_count == 0 or (bar_count > 0 and sig_count == 0)
    if need_seed:
        reason = '数据库为空' if bar_count == 0 else '形态信号缺失（旧版种子脚本未生成信号）'
        print(f'[start] {reason}，生成种子数据...')
        from scripts.generate_synthetic_data import main as seed_main
        await seed_main()

asyncio.run(main())
" 2>&1

echo "[start] 启动服务..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
