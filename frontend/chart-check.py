"""检查 K 线图容器高度是否溢出屏幕"""
from playwright.sync_api import sync_playwright

VIEWPORT = {"width": 1440, "height": 900}

pages_to_check = [
    ("/learn", "学堂页面"),
    ("/stock/600519", "股票详情页"),
    ("/learn/patterns/hammer", "形态详情页"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport=VIEWPORT)

    for path, label in pages_to_check:
        print(f"\n{'='*60}")
        print(f"  {label}: {path}")
        print(f"{'='*60}")

        page.goto(f"http://localhost:5173{path}", timeout=15000)
        page.wait_for_load_state("networkidle")

        # 截图
        page.screenshot(path=f"/tmp/shot-{path.replace('/', '-')}.png", full_page=True)

        # 测量 K 线图/图表容器容量
        chart_info = page.evaluate("""() => {
            const charts = document.querySelectorAll('canvas, [class*="chart"], [class*="kline"], div[style*="height"]');
            const results = [];

            // 查找所有带 height 样式的大容器
            const allDivs = document.querySelectorAll('div');
            allDivs.forEach((div) => {
                const rect = div.getBoundingClientRect();
                const computed = getComputedStyle(div);
                const h = parseFloat(computed.height);
                if (h > 400 && h < 2000) {
                    results.push({
                        tag: div.tagName,
                        height: h,
                        width: parseFloat(computed.width),
                        top: Math.round(rect.top),
                        bottom: Math.round(rect.bottom),
                        class: div.className?.toString()?.substring(0,60) || '',
                        id: div.id || '',
                        overflow: computed.overflow,
                    });
                }
            });
            return results;
        }""")

        vh = page.evaluate("() => window.innerHeight")

        print(f"  视口高度: {vh}px")
        print(f"  >400px 高度的容器:")
        for c in chart_info:
            mark = " <<< 溢出!" if c["bottom"] > vh + 20 else ""
            print(f"    {c['class'] or c['id'] or c['tag']}: {c['height']:.0f}px (top={c['top']}, bottom={c['bottom']}){mark}")

        # 查 ECharts 容器
        echarts_info = page.evaluate("""() => {
            const containers = document.querySelectorAll('[ref], [class*="chart"], [style*="500"]');
            const results = [];
            containers.forEach(el => {
                const rect = el.getBoundingClientRect();
                const h = rect.height;
                if (h > 200) {
                    results.push({
                        height: Math.round(h),
                        top: Math.round(rect.top),
                        isVisible: rect.bottom <= window.innerHeight + 20,
                    });
                }
            });
            return results;
        }""")
        print(f"  ECharts 图表容器:")
        for e in echarts_info:
            print(f"    高度: {e['height']}px, 在可视区内: {e['isVisible']}")
        print(f"  截图: /tmp/shot{path.replace('/', '-')}.png")

    browser.close()
    print("\n完成。")
