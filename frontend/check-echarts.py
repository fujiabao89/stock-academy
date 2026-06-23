"""检查 ECharts 是否正常渲染"""
from playwright.sync_api import sync_playwright
import os

OUT = os.path.dirname(os.path.abspath(__file__)) + "/.screenshots"
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    print("--- /stock/600519 ---")
    page.goto("http://localhost:5173/stock/600519", timeout=15000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    page.screenshot(path=f"{OUT}/stock-final.png", full_page=True)

    info = page.evaluate("""() => {
        const vh = window.innerHeight;
        const docH = document.documentElement.scrollHeight;

        // 找 SVG 和 Canvas
        const media = [];
        document.querySelectorAll('svg, canvas').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 50 && r.height > 50) {
                media.push({tag: el.tagName, h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top)});
            }
        });

        // 找包含 "path" 或 "rect" 的 SVG（ECharts 渲染的蜡烛）
        const candlePaths = document.querySelectorAll('svg path').length;
        const svgRects = document.querySelectorAll('svg rect').length;

        // 找价格数字（是否在图表上有显示）
        const texts = [];
        document.querySelectorAll('svg text').forEach(el => {
            const t = el.textContent?.trim() || '';
            if (/^\d+/.test(t) && t.length > 2) {
                texts.push(t.slice(0, 10));
            }
        });

        // 检查 K 线图的位置和重叠
        const chartArea = document.querySelector('[style*="flex: 1"]');
        const chartRect = chartArea ? chartArea.getBoundingClientRect() : null;

        return {
            vh, docH,
            overflow: docH - vh,
            media: media.slice(0, 5),
            svgPaths: candlePaths,
            svgRects: svgRects,
            priceTexts: texts.slice(0, 6),
            chartAreaBottom: chartRect ? Math.round(chartRect.bottom) : 0,
        };
    }""")

    print(f"视口: {info['vh']}px, 文档: {info['docH']}px, 溢出: {info['overflow']}px")
    print(f"SVG/Canvas: {info['media']}")
    print(f"SVG paths: {info['svgPaths']}, SVG rects: {info['svgRects']}")
    print(f"价格文本样本: {info['priceTexts']}")
    print(f"图表区域底部: {info['chartAreaBottom']}px (视口底: {info['vh']}px)")

    if info['svgPaths'] > 0:
        print("OK — ECharts 正常渲染")
    else:
        print("WARNING — 可能 ECharts 未渲染，检查数据加载")

    if info['overflow'] == 0:
        print("OK — 页面无溢出，一屏显示")
    else:
        print(f"WARNING — 页面溢出 {info['overflow']}px")

    browser.close()
