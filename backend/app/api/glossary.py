"""术语词典 API"""

from fastapi import APIRouter, Query

router = APIRouter(prefix="/glossary", tags=["glossary"])


# MVP 阶段术语词典预定义
_GLOSSARY: dict[str, dict] = {}


@router.get("")
async def search_glossary(q: str = Query(..., min_length=1, description="搜索关键词")):
    """搜索术语"""
    q_lower = q.lower().strip()
    results = []
    for term, info in _GLOSSARY.items():
        if q_lower in term.lower() or q_lower in info.get("aliases", []):
            results.append({"term": term, **info})
    return results[:20]
