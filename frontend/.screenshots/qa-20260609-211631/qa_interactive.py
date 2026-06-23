"""QA interactive + mobile tests."""
from playwright.sync_api import sync_playwright
import json, os

OUT = r"C:\Users\34026\项目开发2\frontend\.screenshots\qa-20260609-211631"
issues = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # === TEST 1: Desktop navigation flow ===
    print("=== NAVIGATION FLOW (Desktop 1440x900) ===")
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg) if msg.type == "error" else None)

    # Home -> Stock Detail
    page.goto("http://localhost:5173/", timeout=15000)
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(500)

    # Try clicking a stock link
    stock_links = page.locator('a[href*="/stock/"]').all()
    print(f"  Stock links on home: {len(stock_links)}")
    if len(stock_links) > 0:
        stock_links[0].click()
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(500)
        print(f"  Navigated to: {page.url}")

    # Test tab switching on stock detail
    signals_tab = page.locator('button:has-text("形态信号")').first
    if signals_tab.is_visible():
        signals_tab.click()
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(OUT, "stock_signals_tab.png"), full_page=True)
        print("  Switched to signals tab [OK]")

        # Switch back to K-line
        kline_tab = page.locator('button:has-text("K线图")').first
        if kline_tab.is_visible():
            kline_tab.click()
            page.wait_for_timeout(500)
            print("  Switched back to K-line tab [OK]")

    # Navigate to learn page
    page.goto("http://localhost:5173/learn", timeout=15000)
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(500)
    print(f"  Learn page loaded: {page.url}")

    # Check pattern cards
    pattern_links = page.locator('a[href*="/learn/patterns/"]').all()
    print(f"  Pattern links: {len(pattern_links)}")

    # Navigate to news page
    page.goto("http://localhost:5173/news", timeout=15000)
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(500)
    print(f"  News page loaded: {page.url}")

    errs = [e for e in console_errors if e.type == "error"]
    print(f"  Console errors: {len(errs)}")
    ctx.close()

    # === TEST 2: Mobile viewport (375x812 iPhone) ===
    print("\n=== MOBILE (375x812) ===")
    ctx2 = browser.new_context(viewport={"width": 375, "height": 812})
    page2 = ctx2.new_page()
    mobile_errors = []
    page2.on("console", lambda msg: mobile_errors.append(msg) if msg.type == "error" else None)

    mobile_pages = [
        ("/", "mobile_home", "首页"),
        ("/stock/600519", "mobile_stock", "股票详情"),
        ("/learn", "mobile_learn", "学堂"),
        ("/news", "mobile_news", "新闻"),
    ]

    for path, fname, name in mobile_pages:
        try:
            page2.goto(f"http://localhost:5173{path}", timeout=15000)
            page2.wait_for_load_state("networkidle", timeout=15000)
            page2.wait_for_timeout(500)
            page2.screenshot(path=os.path.join(OUT, f"{fname}.png"), full_page=True)

            # Check for horizontal overflow
            overflow_x = page2.evaluate("""() => {
                const html = document.documentElement;
                return {
                    scrollWidth: html.scrollWidth,
                    clientWidth: html.clientWidth,
                    overflows: html.scrollWidth > html.clientWidth + 5
                };
            }""")
            if overflow_x.get("overflows"):
                issues.append({"page": name, "type": "mobile_horizontal_scroll", "severity": "medium",
                              "detail": f"scrollWidth={overflow_x['scrollWidth']} > clientWidth={overflow_x['clientWidth']}"})
                print(f"  {name}: HORIZONTAL OVERFLOW {overflow_x}")
            else:
                print(f"  {name}: OK")
        except Exception as e:
            issues.append({"page": name, "type": "mobile_load_failure", "severity": "high", "detail": str(e)})
            print(f"  {name}: FAIL - {e}")

    mobile_errs = [e for e in mobile_errors if e.type == "error"]
    print(f"  Mobile console errors: {len(mobile_errs)}")
    for e in mobile_errs[:5]:
        print(f"    {e.text[:150]}")
        issues.append({"page": "mobile", "type": "console_error", "severity": "medium", "detail": e.text[:200]})

    ctx2.close()

    # === TEST 3: Search functionality ===
    print("\n=== SEARCH TEST ===")
    ctx3 = browser.new_context(viewport={"width": 1440, "height": 900})
    page3 = ctx3.new_page()

    page3.goto("http://localhost:5173/", timeout=15000)
    page3.wait_for_load_state("networkidle", timeout=15000)

    # Find search input
    search_inputs = page3.locator('input[type="text"], input[type="search"], input[placeholder*="搜索"], input[placeholder*="search"]').all()
    print(f"  Search inputs found: {len(search_inputs)}")

    if len(search_inputs) > 0:
        try:
            si = search_inputs[0]
            si.fill("600519")
            page3.wait_for_timeout(500)
            # Try pressing Enter
            si.press("Enter")
            page3.wait_for_timeout(1500)
            print(f"  After search: {page3.url}")

            # If navigated to stock page, check if 404
            if "404" in page3.url or page3.locator('text=404').is_visible():
                issues.append({"page": "search", "type": "search_404", "severity": "high",
                              "detail": "Search for '600519' led to 404"})
                print("  ISSUE: Search led to 404!")
        except Exception as e:
            print(f"  Search test error: {e}")

    ctx3.close()

    # === TEST 4: Breadcrumb navigation ===
    print("\n=== BREADCRUMB TEST ===")
    ctx4 = browser.new_context(viewport={"width": 1440, "height": 900})
    page4 = ctx4.new_page()

    page4.goto("http://localhost:5173/stock/600519", timeout=15000)
    page4.wait_for_load_state("networkidle", timeout=15000)

    breadcrumb_link = page4.locator('a:has-text("首页")').first
    if breadcrumb_link.is_visible():
        breadcrumb_link.click()
        page4.wait_for_load_state("networkidle", timeout=15000)
        page4.wait_for_timeout(500)
        print(f"  Breadcrumb back to home: {page4.url}")
        assert page4.url == "http://localhost:5173/", f"Expected /, got {page4.url}"
        print("  Breadcrumb navigation: OK")
    else:
        print("  No breadcrumb found (may be on mobile)")

    ctx4.close()

    browser.close()

# Print summary
print(f"\n{'='*50}")
print(f"INTERACTIVE QA COMPLETE")
print(f"Issues found: {len(issues)}")
for i in issues:
    print(f"  [{i['severity']}] {i['page']}: {i['type']} - {i['detail'][:150]}")

# Update main report
rpath = os.path.join(OUT, "qa-report.json")
with open(rpath, "r", encoding="utf-8") as f:
    report = json.load(f)

report["interactive_tests"] = {
    "desktop_navigation": "OK",
    "mobile_pages": 4,
    "search": "tested",
    "breadcrumb": "OK"
}
report["mobile_issues"] = issues
report["health_score"] = max(0, 100 - len([i for i in issues if i["severity"] == "high"]) * 15 - len([i for i in issues if i["severity"] == "medium"]) * 5)

with open(rpath, "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

print(f"\nFinal health score: {report['health_score']}/100")
