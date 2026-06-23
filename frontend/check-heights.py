"""截图 + 详细测量"""
from playwright.sync_api import sync_playwright
import os

OUT = os.path.dirname(os.path.abspath(__file__)) + "/.screenshots"
os.makedirs(OUT, exist_ok=True)

VP = {"width": 1440, "height": 900}

checks = [
    ("/learn", "learn"),
    ("/stock/600519", "stock-600519"),
    ("/learn/patterns/hammer", "pattern-hammer"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport=VP)

    for path, name in checks:
        print(f"\n--- {name} ({path}) ---")
        page.goto(f"http://localhost:5173{path}", timeout=15000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(500)

        fname = f"{OUT}/{name}.png"
        page.screenshot(path=fname, full_page=True)

        info = page.evaluate("""() => {
            const vh = window.innerHeight;
            const docH = document.documentElement.scrollHeight;
            const charts = document.querySelectorAll('[ref]');
            const result = { vh, docH, charts: [], bigDivs: [] };

            charts.forEach(el => {
                const r = el.getBoundingClientRect();
                result.charts.push({h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top)});
            });

            document.querySelectorAll('div').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.height > 300) {
                    result.bigDivs.push({
                        h: Math.round(r.height), top: Math.round(r.top),
                        cls: el.className?.toString()?.slice(0,50) || '',
                        id: el.id || '',
                        style: el.getAttribute('style')?.slice(0,80) || '',
                    });
                }
            });
            return result;
        }""")

        print(f"  视口: {info['vh']}px, 文档总高: {info['docH']}px, 超出: {info['docH'] - info['vh']}px")
        print(f"  ECharts ref 容器: {info['charts']}")
        print(f"  >300px 的大 div:")
        for d in info['bigDivs'][:8]:
            print(f"    {d['h']}px top={d['top']} {d['cls'] or d['id'] or 'DIV'} | {d['style'][:60]}")

        print(f"  截图: {fname}")

    browser.close()
    print("\n完成")
