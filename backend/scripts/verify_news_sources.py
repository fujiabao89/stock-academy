"""新闻数据源可行性验证脚本

按 Phase 2 设计文档要求，对 3 只测试股票连续 3 天定时采集。

真实数据流：
- 新浪财经 API：获取全市场 A 股新闻 → 标题中做股票名称/代码关键词匹配
- Tushare news 接口：按 ts_code 获取个股新闻（备选）

输出 JSON 日志到 backend/data/news_verify_log.jsonl
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timedelta
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import tushare as ts
from app.config import settings

# ---------- 配置 ----------

TEST_STOCKS = [
    ("000001", "平安银行"),
    ("600519", "贵州茅台"),
    ("300750", "宁德时代"),
]

SINA_BASE = "https://feed.mix.sina.com.cn/api/roll/get"
SINA_LID = "2509"  # A 股财经新闻频道
SINA_FETCH_COUNT = 100  # 每次抓取条数

LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
LOG_FILE = os.path.join(LOG_DIR, "news_verify_log.jsonl")
SUMMARY_FILE = os.path.join(LOG_DIR, "news_verify_summary.json")


def log_entry(entry: dict):
    entry["timestamp"] = datetime.now().isoformat()
    os.makedirs(LOG_DIR, exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def count_stock_matches(items: list[dict], code: str, name: str) -> int:
    """统计新闻标题中匹配到目标股票的数量"""
    count = 0
    for item in items:
        title = item.get("title", "") + item.get("intro", "")
        if code in title or name in title:
            count += 1
    return count


def test_sina_general() -> dict:
    """测试新浪财经全市场新闻抓取 + 关键词匹配"""
    url = f"{SINA_BASE}?pageid=153&lid={SINA_LID}&num={SINA_FETCH_COUNT}&r={time.time()}"
    try:
        req = Request(url, headers={"User-Agent": "stock-academy-verify/1.0"})
        resp = urlopen(req, timeout=15)
        data = json.loads(resp.read())
        items = data.get("result", {}).get("data", [])
        total = data.get("result", {}).get("total", 0)

        # 统计每只测试股票的命中数
        matches = {}
        for code, name in TEST_STOCKS:
            matches[f"{code}({name})"] = count_stock_matches(items, code, name)

        return {
            "source": "sina_finance",
            "method": "general_a_share",
            "fetch_count": len(items),
            "total_available": total,
            "stock_matches": matches,
            "sample_titles": [item.get("title", "")[:80] for item in items[:5]],
            "error": None,
        }
    except (URLError, HTTPError, json.JSONDecodeError, KeyError) as e:
        return {
            "source": "sina_finance",
            "method": "general_a_share",
            "fetch_count": 0,
            "total_available": 0,
            "stock_matches": {},
            "sample_titles": [],
            "error": str(e)[:200],
        }


def test_tushare_news(ts_code: str, name: str) -> dict:
    """测试 Tushare 个股新闻接口"""
    try:
        ts.set_token(settings.tushare_token)
        pro = ts.pro_api()
        df = pro.news(ts_code=ts_code, limit=10)

        count = len(df) if df is not None else 0
        # tushare news 的 title 列常为 NaN，用 content 前 80 字代替
        samples = []
        if df is not None and count > 0:
            for _, row in df.head(5).iterrows():
                title = row.get("title")
                if not isinstance(title, str) or title == "nan":
                    content = str(row.get("content", ""))
                    title = content[:80]
                samples.append(title)

        return {
            "source": "tushare",
            "method": "stock_news",
            "keyword": f"{ts_code}({name})",
            "count": count,
            "sample_titles": samples,
            "error": None,
        }
    except Exception as e:
        return {
            "source": "tushare",
            "method": "stock_news",
            "keyword": f"{ts_code}({name})",
            "count": 0,
            "sample_titles": [],
            "error": str(e)[:200],
        }


def run_round() -> list[dict]:
    results = []

    # 新浪：全市场新闻抓取（只做一次，不做关键词搜索）
    results.append(test_sina_general())

    # Tushare：每只个股分别获取
    for code, name in TEST_STOCKS:
        ts_code = f"{code}.{'SZ' if code.startswith(('0','3')) else 'SH'}"
        results.append(test_tushare_news(ts_code, name))
        time.sleep(2)

    return results


def compute_summary():
    if not os.path.exists(LOG_FILE):
        return None

    entries = []
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                entries.append(json.loads(line))

    total = len(entries)
    success = sum(1 for e in entries if e.get("error") is None and e.get("count", e.get("fetch_count", 0)) > 0)
    errors = sum(1 for e in entries if e.get("error") is not None)
    empty = sum(1 for e in entries if e.get("error") is None and e.get("count", e.get("fetch_count", 0)) == 0)

    by_source = {}
    for e in entries:
        src = e.get("source", "unknown")
        if src not in by_source:
            by_source[src] = {"total": 0, "success": 0, "articles": 0}
        by_source[src]["total"] += 1
        article_count = e.get("count", e.get("fetch_count", 0))
        if e.get("error") is None and article_count > 0:
            by_source[src]["success"] += 1
        by_source[src]["articles"] += article_count

    return {
        "computed_at": datetime.now().isoformat(),
        "total_requests": total,
        "successful": success,
        "errors": errors,
        "empty": empty,
        "success_rate": round(success / total * 100, 1) if total > 0 else 0,
        "by_source": by_source,
    }


if __name__ == "__main__":
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 新闻源验证 — 开始采集")
    results = run_round()

    for r in results:
        log_entry(r)
        if r["source"] == "sina_finance":
            status = "OK" if not r["error"] and r["fetch_count"] > 0 else "ERROR"
            print(f"  [{status}] 新浪全市场 → {r['fetch_count']}/{r['total_available']}条")
            if r.get("stock_matches"):
                for stock, n in r["stock_matches"].items():
                    print(f"         {stock}: {n}条命中")
        else:
            status = "OK" if not r["error"] and r["count"] > 0 else "EMPTY" if not r["error"] else "ERROR"
            print(f"  [{status}] Tushare '{r['keyword']}' → {r['count']}条"
                  + (f"  错误: {r['error']}" if r["error"] else ""))

    summary = compute_summary()
    if summary:
        with open(SUMMARY_FILE, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        print(f"\n成功率: {summary['success_rate']}% ({summary['successful']}/{summary['total_requests']})")
        print(f"汇总: {SUMMARY_FILE}")
    print(f"日志: {LOG_FILE}")
