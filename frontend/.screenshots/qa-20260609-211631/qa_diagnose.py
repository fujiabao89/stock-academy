"""Diagnose console errors and mobile overflow."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # === Console errors on stock/000001 ===
    print("=== CONSOLE ERRORS (stock/000001) ===")
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error", "warning") else None)

    page.goto("http://localhost:5173/stock/000001", timeout=15000)
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(1000)

    # Switch to signals tab to trigger more interactions
    signals_tab = page.locator('button:has-text("形态信号")').first
    if signals_tab.is_visible():
        signals_tab.click()
        page.wait_for_timeout(1000)

    for e in errors:
        print(f"  {e[:200]}")
    ctx.close()

    # === Mobile overflow source ===
    print("\n=== MOBILE OVERFLOW SOURCE (/) ===")
    ctx2 = browser.new_context(viewport={"width": 375, "height": 812})
    page2 = ctx2.new_page()

    page2.goto("http://localhost:5173/", timeout=15000)
    page2.wait_for_load_state("networkidle", timeout=15000)
    page2.wait_for_timeout(500)

    # Find the widest element
    overflow_info = page2.evaluate("""() => {
        const all = document.querySelectorAll('*');
        const wide = [];
        for (const el of all) {
            const r = el.getBoundingClientRect();
            if (r.width > 375) {
                wide.push({
                    tag: el.tagName,
                    id: el.id,
                    class: el.className?.toString?.()?.substring(0, 80) || '',
                    width: Math.round(r.width),
                    left: Math.round(r.left),
                    right: Math.round(r.right)
                });
            }
        }
        // Sort by width desc, take top 10
        wide.sort((a, b) => b.width - a.width);
        return wide.slice(0, 10);
    }""")
    for w in overflow_info:
        print(f"  {w['tag']}#{w['id']} .{w['class'][:50]} width={w['width']} left={w['left']} right={w['right']}")
    ctx2.close()

    browser.close()
