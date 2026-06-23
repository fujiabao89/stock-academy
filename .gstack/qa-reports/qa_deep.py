"""QA 深度测试 — 移动端、网络请求、API 响应时间"""
import os, json
from playwright.sync_api import sync_playwright

REPORT_DIR = ".gstack/qa-reports/screenshots"

results = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 720})

    # 收集网络请求
    network_requests = []
    page.on("request", lambda req: network_requests.append({
        "url": req.url, "method": req.method, "type": req.resource_type
    }))
    network_responses = []
    page.on("response", lambda resp: network_responses.append({
        "url": resp.url, "status": resp.status,
    }))

    # 收集控制台错误
    console_msgs = []
    page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))

    print("=" * 60)
    print("测试: 首页 (/) — 桌面 + 移动 + 网络")
    print("=" * 60)

    network_requests.clear()
    network_responses.clear()
    console_msgs.clear()

    page.goto("http://localhost:5173/", timeout=15000)
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(2000)

    # API 请求统计
    api_requests = [r for r in network_requests if "/api/" in r["url"]]
    api_responses = [r for r in network_responses if "/api/" in r["url"]]
    api_failures = [r for r in api_responses if r["status"] >= 400]
    js_errors = [m for m in console_msgs if "[error]" in m.lower()]

    print(f"  API请求: {len(api_requests)} | 失败: {len(api_failures)} | JS错误: {len(js_errors)}")
    for r in api_requests:
        matching = [resp for resp in api_responses if resp["url"] == r["url"]]
        status = matching[0]["status"] if matching else "?"
        flag = " <-- ERROR" if (isinstance(status, int) and status >= 400) else ""
        print(f"    {r['method']} {status} {r['url'][:80]}{flag}")
    if api_failures:
        print(f"  [ISSUE] API failures detected!")
    if js_errors:
        for e in js_errors[:3]:
            print(f"  [JS_ERROR] {e[:150]}")

    # 移动端测试
    mobile_viewport = {"width": 375, "height": 812}
    page.set_viewport_size(mobile_viewport)
    page.wait_for_timeout(500)
    mobile_path = os.path.join(REPORT_DIR, "home-mobile.png")
    page.screenshot(path=mobile_path, full_page=True)
    print(f"  移动端截图: {mobile_path}")

    # 恢复桌面
    page.set_viewport_size({"width": 1280, "height": 720})

    # 测试每页的网络请求
    test_pages = [
        ("/stock/000001", "股票详情页"),
        ("/patterns", "K线形态页"),
        ("/watchlist", "自选页"),
    ]

    for url, name in test_pages:
        print(f"\n{'='*60}")
        print(f"测试: {name} ({url}) — 网络请求")
        print(f"{'='*60}")

        network_requests.clear()
        network_responses.clear()
        console_msgs.clear()

        page.goto(f"http://localhost:5173{url}", timeout=15000)
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(2000)

        api_requests = [r for r in network_requests if "/api/" in r["url"]]
        api_responses = [r for r in network_responses if "/api/" in r["url"]]
        api_failures = [r for r in api_responses if r["status"] >= 400]
        js_errors = [m for m in console_msgs if "[error]" in m.lower()]

        print(f"  API请求: {len(api_requests)} | 失败: {len(api_failures)} | JS错误: {len(js_errors)}")
        for r in api_requests:
            matching = [resp for resp in api_responses if resp["url"] == r["url"]]
            status = matching[0]["status"] if matching else "?"
            flag = " <-- ERROR" if (isinstance(status, int) and status >= 400) else ""
            print(f"    {r['method']} {status} {r['url'][:80]}{flag}")
        if api_failures:
            print(f"  [ISSUE] API failures detected!")
        if js_errors:
            for e in js_errors[:3]:
                print(f"  [JS_ERROR] {e[:150]}")

    browser.close()

    print(f"\n{'='*60}")
    print("深度测试完成")
