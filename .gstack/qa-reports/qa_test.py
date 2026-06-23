"""QA 浏览器测试脚本 — 测试前端页面渲染、控制台错误、关键交互元素"""
import os
import json
from playwright.sync_api import sync_playwright

REPORT_DIR = ".gstack/qa-reports/screenshots"
os.makedirs(REPORT_DIR, exist_ok=True)

PAGES = [
    {"name": "home", "url": "http://localhost:5173/", "title": "首页"},
    {"name": "stock-detail", "url": "http://localhost:5173/stock/000001", "title": "股票详情页"},
    {"name": "patterns", "url": "http://localhost:5173/patterns", "title": "K线形态页"},
    {"name": "watchlist", "url": "http://localhost:5173/watchlist", "title": "自选页"},
]

results = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 720})

    # 收集控制台错误
    console_errors = []
    page.on("console", lambda msg: (
        console_errors.append(f"[{msg.type}] {msg.text}")
        if msg.type in ("error", "warning") else None
    ))

    for entry in PAGES:
        print(f"\n{'='*60}")
        print(f"测试: {entry['title']} ({entry['url']})")
        print(f"{'='*60}")

        console_errors.clear()
        page_errors = []

        try:
            page.goto(entry["url"], timeout=15000)
            page.wait_for_load_state("networkidle", timeout=15000)
            page.wait_for_timeout(2000)  # 等动画/异步渲染完成
        except Exception as e:
            page_errors.append(f"页面加载失败: {e}")

        # 截图
        screenshot_path = os.path.join(REPORT_DIR, f"{entry['name']}.png")
        try:
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"  截图: {screenshot_path}")
        except Exception as e:
            page_errors.append(f"截图失败: {e}")

        # 检查 body 内容
        try:
            body_text = page.locator("body").inner_text(timeout=3000)
            text_len = len(body_text.strip())
            has_content = text_len > 20
        except:
            body_text = ""
            text_len = 0
            has_content = False

        # 检查关键元素
        elements_found = []
        elements_missing = []
        key_selectors = ["a", "button", "nav", "main", "h1", "h2"]
        for sel in key_selectors:
            try:
                count = page.locator(sel).count()
                if count > 0:
                    elements_found.append(f"{sel}({count})")
                else:
                    elements_missing.append(sel)
            except:
                elements_missing.append(sel)

        # 收集 JS 错误
        js_errors = [e for e in console_errors if "[error]" in e.lower()]
        js_warnings = [e for e in console_errors if "[warning]" in e.lower()]

        result = {
            "page": entry["title"],
            "url": entry["url"],
            "loaded": len(page_errors) == 0,
            "has_content": has_content,
            "body_text_length": text_len,
            "elements_found": elements_found,
            "elements_missing": elements_missing,
            "js_errors": js_errors,
            "js_warnings": js_warnings,
            "page_errors": page_errors,
            "screenshot": screenshot_path,
        }
        results.append(result)

        # 打印摘要
        status = "PASS" if result["loaded"] and result["has_content"] and len(js_errors) == 0 else "FAIL"
        print(f"  [{status}] loaded={result['loaded']} | content_len={text_len} | js_errors={len(js_errors)}")
        if elements_found:
            print(f"  元素: {', '.join(elements_found)}")
        if elements_missing:
            print(f"  [WARN] missing_elements: {', '.join(elements_missing)}")
        if js_errors:
            for e in js_errors[:5]:
                print(f"  [JS_ERROR] {e[:120]}")
        if page_errors:
            for e in page_errors:
                print(f"  [PAGE_ERROR] {e}")

    browser.close()

    # 汇总
    print(f"\n{'='*60}")
    print("QA 测试汇总")
    print(f"{'='*60}")
    passed = sum(1 for r in results if r["loaded"] and r["has_content"] and len(r["js_errors"]) == 0)
    total_js_errors = sum(len(r["js_errors"]) for r in results)
    total_js_warnings = sum(len(r["js_warnings"]) for r in results)
    print(f"通过: {passed}/{len(results)}")
    print(f"JS 错误总数: {total_js_errors}")
    print(f"JS 警告总数: {total_js_warnings}")

    # 保存 JSON 报告
    report_path = ".gstack/qa-reports/baseline.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n报告: {report_path}")
