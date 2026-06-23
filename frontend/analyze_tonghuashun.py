"""分析同花顺 K 线图布局"""
from playwright.sync_api import sync_playwright
import os, json

OUT = os.path.dirname(os.path.abspath(__file__)) + "/.screenshots"
os.makedirs(OUT, exist_ok=True)

VP = {"width": 1440, "height": 900}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport=VP)

    print("--- 加载同花顺 000001 ---")
    page.goto("https://stockpage.10jqka.com.cn/000001/", timeout=30000)
    page.wait_for_timeout(5000)  # 等 JS 渲染图表

    # 截图
    page.screenshot(path=f"{OUT}/tonghuashun-000001.png", full_page=True)
    print(f"截图: {OUT}/tonghuashun-000001.png")

    # 测量布局
    info = page.evaluate("""() => {
        const vh = window.innerHeight;
        const docH = document.documentElement.scrollHeight;

        // 找 K 线图相关的元素
        const charts = [];
        document.querySelectorAll('canvas, svg').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 100 && r.height > 100) {
                charts.push({tag: el.tagName, h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top), left: Math.round(r.left)});
            }
        });

        // 找所有大容器
        const bigDivs = [];
        document.querySelectorAll('div, section, main').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.height > 200) {
                bigDivs.push({
                    h: Math.round(r.height), top: Math.round(r.top),
                    cls: el.className?.toString()?.slice(0,60) || '',
                    id: el.id || '',
                });
            }
        });

        // 找价格头栏元素
        const priceHeaders = [];
        document.querySelectorAll('*').forEach(el => {
            const text = el.textContent?.trim() || '';
            const style = window.getComputedStyle(el);
            if ((text.includes('涨跌') || text.includes('涨幅') || text.includes('昨收')) && el.children.length <= 3) {
                const r = el.getBoundingClientRect();
                if (r.width > 200) {
                    priceHeaders.push({
                        text: text.slice(0, 100),
                        h: Math.round(r.height), top: Math.round(r.top),
                        fs: style.fontSize, cls: el.className?.toString()?.slice(0,50) || '',
                    });
                }
            }
        });

        // 找包含价格数字的大字元素（可能在价格头栏）
        const bigPrices = [];
        document.querySelectorAll('span, div, p, strong, b').forEach(el => {
            const text = el.textContent?.trim() || '';
            const style = window.getComputedStyle(el);
            const fs = parseFloat(style.fontSize);
            const r = el.getBoundingClientRect();
            if (fs >= 20 && /^\d+\.\d+/.test(text) && r.width < 400) {
                bigPrices.push({
                    text: text.slice(0, 40),
                    h: Math.round(r.height), top: Math.round(r.top),
                    fs: style.fontSize, tag: el.tagName,
                });
            }
        });

        return {
            vh, docH,
            overflow: docH - vh,
            charts: charts.slice(0, 10),
            bigDivs: bigDivs.slice(0, 12),
            priceHeaders: priceHeaders.slice(0, 5),
            bigPrices: bigPrices.slice(0, 5),
        };
    }""")

    print(f"\n视口: {info['vh']}px, 文档总高: {info['docH']}px, 超出: {info['overflow']}px")
    print(f"\nCanvas/SVG 图表元素:")
    for c in info['charts']:
        print(f"  {c['tag']} {c['w']}x{c['h']}px top={c['top']} left={c['left']}")

    print(f"\n>200px 的大容器:")
    for d in info['bigDivs'][:15]:
        print(f"  {d['h']}px top={d['top']} {d['cls'] or d['id'] or 'DIV'}")

    print(f"\n价格头栏相关:")
    for p in info['priceHeaders']:
        print(f"  {p['h']}px top={p['top']} fs={p['fs']} | {p['text'][:80]}")
    for p in info['bigPrices']:
        print(f"  {p['h']}px top={p['top']} fs={p['fs']} | {p['text'][:40]}")

    browser.close()
    print("\n完成")
