"""形态相关 API 端点"""

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/patterns", tags=["patterns"])


@router.get("/{pattern_id}")
async def get_pattern_detail(pattern_id: str):
    """形态教学详情（定义、回测数据、当前触发股票）"""
    # TODO: 从形态注册表 + 回测数据文件查询
    raise HTTPException(status_code=501, detail="功能开发中")


@router.get("/{pattern_id}/stocks")
async def get_pattern_stocks(pattern_id: str):
    """当前触发该形态的所有股票"""
    # TODO: 从 pattern_signals 表查询
    raise HTTPException(status_code=501, detail="功能开发中")
