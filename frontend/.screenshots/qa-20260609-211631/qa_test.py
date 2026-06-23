"""QA baseline test — localhost:5173 — Standard tier."""
from playwright.sync_api import sync_playwright
import json, os, time

OUT = r"C:\Users\34026\项目开发2\frontend\.screenshots\qa-20260609-211631"
os.makedirs(OUT, exist_ok=True)

PAGES = [
    ("/", "首页"),
    ("/stock/600519", "股票详情-K线"),
    ("/learn", "学堂"),
    ("/learn/patterns/hammer", "形态详情"),
    ("/news", "新闻"),
]

results = []
issues = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()

    for path, name in PAGES:
        console_errors = []
        page.on("console", lambda msg: (
            console_errors.append(f"[{msg.type}] {msg.text}")
            if msg.type == "error" else None
        ))

        url = f"http://localhost:5173{path}"
        print(f"\n{'='*60}")
        print(f"TESTING: {name} ({url})")
        print(f"{'='*60}")

        try:
            page.goto(url, timeout=15000)
            page.wait_for_load_state("networkidle", timeout=15000)
            page.wait_for_timeout(1000)  # extra settle for ECharts
        except Exception as e:
            issues.append({"page": name, "severity": "high", "type": "load_failure", "detail": str(e)})
            results.append({"page": name, "url": url, "status": "FAIL", "error": str(e)})
            continue

        # Screenshot
        safe = name.replace("/", "-").replace(" ", "_")
        spath = os.path.join(OUT, f"{safe}.png")
        page.screenshot(path=spath, full_page=True)
        print(f"  screenshot: {spath}")

        # Count console errors
        errs = [e for e in console_errors if "[error]" in e]
        warns = [e for e in console_errors if "[warning]" in e]
        print(f"  console errors: {len(errs)}, warnings: {len(warns)}")
        for e in errs[:5]:
            print(f"    ERR: {e[:120]}")
            issues.append({"page": name, "severity": "medium", "type": "console_error", "detail": e[:200]})

        # K-line specific: measure overflow on stock detail and pattern detail
        if path in ("/stock/600519", "/learn/patterns/hammer"):
            overflow = page.evaluate("""() => {
                const container = document.querySelector('[_echarts_instance_]');
                if (!container) return {error: 'no echarts instance found'};
                const svg = container.querySelector('svg');
                if (!svg) return {error: 'no svg found'};
                const cRect = container.getBoundingClientRect();
                const sRect = svg.getBoundingClientRect();
                // Check all visible elements for overflow
                const types = ['text', 'rect', 'path'];
                const results = {};
                for (const t of types) {
                    const els = svg.querySelectorAll(t);
                    let above = 0, below = 0;
                    for (const el of els) {
                        const r = el.getBoundingClientRect();
                        if (r.height === 0 || r.width === 0) continue;
                        if (r.bottom < cRect.top) above++;
                        if (r.top > cRect.bottom) below++;
                        if (r.top < cRect.top && r.bottom > cRect.top) above++;
                        if (r.bottom > cRect.bottom && r.top < cRect.bottom) below++;
                    }
                    results[t] = {above, below, total: els.length};
                }
                return {
                    container: {top: cRect.top, bottom: cRect.bottom, height: cRect.height},
                    svg: {top: sRect.top, bottom: sRect.bottom, height: sRect.height},
                    overflow: results
                };
            }""")
            print(f"  overflow check: {json.dumps(overflow, indent=2)[:600]}")
            # Count total overflow elements
            total_overflow = sum(
                overflow.get("overflow", {}).get(t, {}).get("above", 0) +
                overflow.get("overflow", {}).get(t, {}).get("below", 0)
                for t in ["text", "rect", "path"]
            )
            if total_overflow > 0:
                issues.append({
                    "page": name, "severity": "medium", "type": "chart_overflow",
                    "detail": f"{total_overflow} elements overflow container",
                    "data": overflow
                })
            else:
                print(f"  OVERFLOW: 0 (clean)")

        # Check page title
        title = page.title()
        print(f"  title: {title}")

        # Check for visible error states
        error_text = page.evaluate("""() => {
            const body = document.body.innerText || '';
            const errPatterns = ['Error', '404', '500', '加载失败', '错误', 'Not Found'];
            for (const p of errPatterns) {
                if (body.includes(p)) return body.substring(
                    Math.max(0, body.indexOf(p) - 50),
                    body.indexOf(p) + 100
                );
            }
            return null;
        }""")
        if error_text:
            issues.append({"page": name, "severity": "high", "type": "error_text_visible", "detail": error_text[:200]})

        results.append({
            "page": name, "url": url, "status": "OK",
            "console_errors": len(errs), "console_warnings": len(warns),
            "title": title
        })

    browser.close()

# Write report
report = {
    "qa_type": "Standard",
    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    "viewport": "1440x900",
    "pages_tested": len(results),
    "pages_passed": sum(1 for r in results if r.get("status") == "OK"),
    "pages_failed": sum(1 for r in results if r.get("status") != "OK"),
    "total_issues": len(issues),
    "results": results,
    "issues": issues,
}

# Severity summary
high = [i for i in issues if i["severity"] == "high"]
medium = [i for i in issues if i["severity"] == "medium"]
low = [i for i in issues if i["severity"] == "low"]

# Health score: start at 100, deduct per issue
health = 100
health -= len(high) * 15
health -= len(medium) * 5
health -= len(low) * 2
health = max(0, health)

report["health_score"] = health
report["severity_breakdown"] = {"high": len(high), "medium": len(medium), "low": len(low)}

rpath = os.path.join(OUT, "qa-report.json")
with open(rpath, "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

print(f"\n{'='*60}")
print(f"QA COMPLETE")
print(f"{'='*60}")
print(f"Pages: {report['pages_passed']}/{report['pages_tested']} passed")
print(f"Issues: {len(issues)} total ({len(high)} high, {len(medium)} medium, {len(low)} low)")
print(f"Health Score: {health}/100")
print(f"Report: {rpath}")
