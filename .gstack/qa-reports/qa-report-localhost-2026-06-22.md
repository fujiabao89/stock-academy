# QA Report — stock-academy (localhost)

**Date:** 2026-06-22
**Branch:** master
**Platform:** Docker Compose (PostgreSQL + Redis + FastAPI + Vite)
**Tier:** Standard
**Duration:** ~15 min

---

## Health Score: 95/100

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Console | 100 | 15% | 15.0 |
| Links | 100 | 10% | 10.0 |
| Visual | 95 | 10% | 9.5 |
| Functional | 95 | 20% | 19.0 |
| UX | 90 | 15% | 13.5 |
| Performance | 95 | 10% | 9.5 |
| Content | 100 | 5% | 5.0 |
| Accessibility | 95 | 15% | 14.3 |
| **Total** | | | **95.8 → 95** |

---

## Test Coverage

### Pages Tested (Browser)

| Page | URL | Result | JS Errors | Notes |
|------|-----|--------|-----------|-------|
| 首页 | `/` | PASS | 0 | 6 API calls, all 200 |
| 学堂 | `/learn` | PASS | 0 | 形态卡片正常渲染 |
| 新闻 | `/news` | PASS | 0 | — |
| 策略 | `/strategies` | PASS | 0 | — |
| 股票详情 | `/stock/000001` | PASS | 0 | K线图 14 canvas 正常 |
| 形态详情 | `/learn/patterns/hammer` | PASS | 0 | 数据+回测图完整 |

### API Endpoints Tested

| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /api/health | 200 | OK |
| GET /api/stocks/search?q=平安 | 200 | 3 results |
| GET /api/stocks/000001/overview | 200 | 数据完整 |
| GET /api/stocks/000001/kline | 200 | K线数据+MA |
| GET /api/stocks/000001/signals | 200 | — |
| GET /api/patterns?limit=5 | 200 | 7+ patterns |
| GET /api/signals/latest | 200 | — |
| GET /api/strategies | 200 | — |
| GET /api/news?limit=5 | 200 | — |
| GET /api/glossary?limit=3 | 200 | — |

All 10 API endpoints: **10/10 PASS (100%)**

---

## Findings

### No Critical/High/Medium Issues Found

All tested routes render correctly. 0 JavaScript errors. All API endpoints return 200.

### Low Severity Observations

1. **API 请求重复 (首页/股票详情)**
   - 观察: signals/latest, strategies, news 等 API 各请求 2 次
   - 原因: React StrictMode (开发模式) 导致的双重渲染
   - 影响: 生产环境不受影响。StrictMode 仅在 dev 模式启用
   - 建议: 无需修复

2. **`/patterns` 直接访问返回 404**
   - 观察: 直接访问 `/patterns` 显示 404 页面
   - 原因: 路由设计如此 — 形态内容在 `/learn` 路径下
   - 影响: 用户需通过 `/learn` 访问形态内容。导航栏链接正确指向 `/learn`
   - 建议: 可考虑添加 `/patterns` → `/learn` 的重定向

3. **`/watchlist` 未登录时跳转登录页**
   - 观察: 未认证用户访问 `/watchlist` 被重定向到 `/login`
   - 原因: ProtectedRoute 组件设计如此
   - 影响: 预期行为，非 bug

---

## Pre-existing Issues (from session context)

- **Docker Vite 代理**: 已修复 — `vite.config.ts` 代理目标从 `localhost:8000` 改为 `backend:8000`
- **klinecharts 依赖**: 已安装到 Docker 容器

---

## Summary

**QA 通过。** 应用在 Docker 环境中正常运行。所有核心页面渲染正确，K 线图正常显示，API 端点全部响应 200。无 JS 错误，无功能性 bug。

**Top 3 Things to Note:**
1. K线图 (klinecharts) 渲染正常 — 14 canvas 元素确认
2. 形态教学数据完整 — API 数据到前端渲染全链路通畅
3. 开发环境 StrictMode 双重请求不影响生产
