"""因子自然语言解析 — DeepSeek few-shot → conditions JSON"""

import json
import re

from ..config import settings
from ..logging import get_logger

logger = get_logger(__name__)

AVAILABLE_FIELDS = [
    "open", "high", "low", "close", "volume",
    "ma5", "ma20", "ma60", "ma120",
    "volume_ratio_20", "high_20", "price_range_20",
    "pattern",
]
AVAILABLE_OPERATORS = ["gt", "lt", "eq", "cross_above", "cross_below", "pattern"]
AVAILABLE_PATTERNS = [
    "golden-cross", "death-cross", "ma-bullish-alignment", "ma-bearish-alignment",
    "ma-convergence-breakout", "volume-up-price-up", "volume-up-price-down",
    "volume-price-divergence", "hammer", "inverted-hammer", "bullish-engulfing",
    "bearish-engulfing", "doji", "shooting-star",
]

FEW_SHOT_EXAMPLES = """
示例1: "MA5上穿MA20"
[{"field":"ma5","operator":"cross_above","field2":"ma20"}]

示例2: "放量上涨"
[{"field":"volume_ratio_20","operator":"gt","value":1.5},{"field":"close","operator":"gt","field2":"open"}]

示例3: "缩量横盘"
[{"field":"volume_ratio_20","operator":"lt","value":0.5},{"field":"price_range_20","operator":"lt","value":0.03}]

示例4: "均线多头排列且放量"
[{"field":"ma5","operator":"gt","field2":"ma20"},{"field":"ma20","operator":"gt","field2":"ma60"},{"field":"volume_ratio_20","operator":"gt","value":1.5}]

示例5: "底部锤子线"
[{"field":"close","operator":"lt","field2":"ma60"},{"field":"pattern","operator":"pattern","pattern_id":"hammer"}]

示例6: "金叉放量突破前高"
[{"field":"ma5","operator":"cross_above","field2":"ma20"},{"field":"volume_ratio_20","operator":"gt","value":1.5},{"field":"close","operator":"gt","field2":"high_20"}]
"""

SYSTEM_PROMPT = f"""你是一个股票技术分析因子解析器。将用户的中文描述解析为 JSON 条件数组。

可用字段: {", ".join(AVAILABLE_FIELDS)}
可用运算符: {", ".join(AVAILABLE_OPERATORS)}
可用形态 pattern_id: {", ".join(AVAILABLE_PATTERNS)}

每个条件的字段含义:
- field: 技术指标字段名
- operator: gt(>), lt(<), eq(=), cross_above(上穿), cross_below(下穿), pattern(形态匹配)
- value: 数值阈值（gt/lt/eq 时使用）
- field2: 比较的目标字段（operator 为 field-vs-field 时使用，如 ma5 > ma20）
- pattern_id: 形态ID（operator 为 pattern 时使用）

规则:
1. 只输出 JSON 数组，不要任何其他文字
2. 所有条件为 AND 关系
3. 如果用户描述无法解析为技术条件，输出 []
4. 数值使用合理默认值（如 "放量" = volume_ratio_20 > 1.5，"缩量" = volume_ratio_20 < 0.5）

{FEW_SHOT_EXAMPLES}"""


class ParseError(Exception):
    """因子解析失败"""


async def parse_natural_language(text: str) -> tuple[list[dict], str]:
    """将自然语言描述解析为 conditions JSON

    Args:
        text: 用户输入的自然语言描述

    Returns:
        (conditions, explanation) — conditions 是 JSON 数组，explanation 是 AI 的解释

    Raises:
        ParseError: 解析失败（DeepSeek 不可用或返回格式无效）
        ValueError: 输入为空
    """
    if not text or not text.strip():
        raise ValueError("输入不能为空")

    text = text.strip()

    api_key = settings.deepseek_api_key
    if not api_key:
        raise ParseError("DeepSeek API 未配置，请使用向导模式手动创建条件")

    try:
        import httpx
    except ImportError:
        raise ParseError("httpx 未安装")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.deepseek_base_url}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.deepseek_model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": text},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 1024,
                },
            )

            if resp.status_code != 200:
                logger.warning("deepseek_parse_error", status=resp.status_code, body=resp.text[:200])
                raise ParseError(f"AI 服务异常 (HTTP {resp.status_code})，请使用向导模式")

            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()

            # 提取 JSON 数组
            conditions = _extract_json(content)
            explanation = _generate_explanation(conditions)

            return conditions, explanation

    except httpx.TimeoutException:
        raise ParseError("AI 服务响应超时，请使用向导模式")
    except ParseError:
        raise
    except Exception as e:
        logger.warning("deepseek_parse_unexpected", error=str(e)[:200])
        raise ParseError(f"解析失败: {e}")


def _extract_json(content: str) -> list[dict]:
    """从 AI 回复中提取 JSON 数组"""
    # 尝试直接解析
    try:
        result = json.loads(content)
        if isinstance(result, list):
            return _validate_conditions(result)
    except json.JSONDecodeError:
        pass

    # 尝试提取 [...] 部分
    match = re.search(r"\[.*\]", content, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group())
            if isinstance(result, list):
                return _validate_conditions(result)
        except json.JSONDecodeError:
            pass

    raise ParseError("AI 返回格式无效，请使用向导模式手动创建条件")


def _validate_conditions(conditions: list[dict]) -> list[dict]:
    """校验并清洗条件"""
    valid = []
    for cond in conditions:
        field = cond.get("field", "")
        operator = cond.get("operator", "")

        if field not in AVAILABLE_FIELDS and field != "pattern":
            continue
        if operator not in AVAILABLE_OPERATORS:
            continue
        if operator == "pattern" and cond.get("pattern_id") not in AVAILABLE_PATTERNS:
            continue

        # 标准化
        clean = {"field": field, "operator": operator}
        if "value" in cond and cond["value"] is not None:
            clean["value"] = float(cond["value"])
        if "field2" in cond:
            clean["field2"] = cond["field2"]
        if "pattern_id" in cond:
            clean["pattern_id"] = cond["pattern_id"]
        valid.append(clean)

    return valid


def _generate_explanation(conditions: list[dict]) -> str:
    """为解析结果生成人类可读的解释"""
    if not conditions:
        return "未能识别出明确的技术条件，请尝试更具体的描述"

    parts = []
    for c in conditions:
        field = c.get("field", "?")
        op = c.get("operator", "?")
        if op == "pattern":
            pid = c.get("pattern_id", "?")
            parts.append(f"出现「{pid}」形态")
        elif op == "cross_above":
            parts.append(f"{field} 上穿 {c.get('field2', '?')}")
        elif op == "cross_below":
            parts.append(f"{field} 下穿 {c.get('field2', '?')}")
        elif op in ("gt", "lt", "eq"):
            target = c.get("value") if c.get("value") is not None else c.get("field2", "?")
            op_name = {"gt": ">", "lt": "<", "eq": "="}[op]
            parts.append(f"{field} {op_name} {target}")
        else:
            parts.append(f"{field} {op} {c.get('value', c.get('field2', '?'))}")

    return "，且 ".join(parts)
