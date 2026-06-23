"""股票名称映射 — 从股票列表缓存或数据库动态加载"""

import json
from pathlib import Path

_STOCK_NAMES: dict[str, tuple[str, str]] = {}

_CACHE = Path(__file__).parent.parent / "scripts" / ".stock_list_cache.json"


def _market(code: str) -> str:
    return "sh" if code.startswith(("6", "5", "9")) else "sz"


def load_stock_names():
    global _STOCK_NAMES
    if _STOCK_NAMES:
        return

    # 优先从缓存文件加载
    if _CACHE.exists():
        try:
            data = json.loads(_CACHE.read_text(encoding="utf-8"))
            for code, name in data.get("stocks", []):
                _STOCK_NAMES[code] = (name, _market(code))
        except (json.JSONDecodeError, KeyError):
            pass

    # 兜底：HS300 样本
    if not _STOCK_NAMES:
        _STOCK_NAMES = {
            "000001": ("平安银行", "sz"),
            "000002": ("万科A", "sz"),
            "000333": ("美的集团", "sz"),
            "000568": ("泸州老窖", "sz"),
            "000651": ("格力电器", "sz"),
            "000858": ("五粮液", "sz"),
            "002142": ("宁波银行", "sz"),
            "002415": ("海康威视", "sz"),
            "002594": ("比亚迪", "sz"),
            "300750": ("宁德时代", "sz"),
            "600000": ("浦发银行", "sh"),
            "600009": ("上海机场", "sh"),
            "600028": ("中国石化", "sh"),
            "600030": ("中信证券", "sh"),
            "600036": ("招商银行", "sh"),
            "600048": ("保利发展", "sh"),
            "600276": ("恒瑞医药", "sh"),
            "600309": ("万华化学", "sh"),
            "600519": ("贵州茅台", "sh"),
            "600585": ("海螺水泥", "sh"),
            "600809": ("山西汾酒", "sh"),
            "600887": ("伊利股份", "sh"),
            "600900": ("长江电力", "sh"),
            "601012": ("隆基绿能", "sh"),
            "601088": ("中国神华", "sh"),
            "601166": ("兴业银行", "sh"),
            "601318": ("中国平安", "sh"),
            "601398": ("工商银行", "sh"),
            "601668": ("中国建筑", "sh"),
            "601888": ("中国中免", "sh"),
        }


def stock_info(code: str) -> tuple[str, str] | None:
    load_stock_names()
    return _STOCK_NAMES.get(code)


_NAME_TO_CODE: dict[str, str] = {}


def _init_name_to_code():
    load_stock_names()
    global _NAME_TO_CODE
    _NAME_TO_CODE = {name: code for code, (name, _) in _STOCK_NAMES.items()}


def find_code_by_name(name: str) -> str | None:
    if not _NAME_TO_CODE:
        _init_name_to_code()
    return _NAME_TO_CODE.get(name)
