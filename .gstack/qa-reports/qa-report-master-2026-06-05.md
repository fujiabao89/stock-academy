# QA Report — stock-academy (master)

**Date**: 2026-06-05
**Commit**: 09e8d3f feat: Phase 2 S6-S7 — 策略引擎 + 策略前端
**Tier**: Standard (Critical/High/Medium)

---

## Health Scores

| Category | Before | After | Delta |
|----------|--------|-------|-------|
| API / Backend | 7/10 | 9/10 | +2 |
| Data Integrity | 8/10 | 9/10 | +1 |
| UI / Frontend | 6/10 | 8/10 | +2 |
| Error Handling | 7/10 | 9/10 | +2 |
| Performance | 8/10 | 8/10 | 0 |
| **Overall** | **7.2/10** | **8.6/10** | **+1.4** |

---

## Issues Found & Fixed (This QA Cycle)

### CRITICAL — None found

### HIGH

| # | Issue | Status |
|---|-------|--------|
| H1 | Docker volume mount 导致 vite.config.ts 修改破坏容器内代理 | ✅ 已修复 — 恢复为 `backend:8000` Docker DNS 名称 |
| H2 | Docker 网络下所有前端请求共享单一 IP，速率限制 (30 req/min) 立即耗尽 | ✅ 已修复 — 私有网络 IP 白名单 (172.x, 192.168.x, 10.x, 127.x) |

### MEDIUM

| # | Issue | Status |
|---|-------|--------|
| M1 | Docker Desktop 引擎启动后需 1-2 分钟完全初始化，期间 API 返回 500 | ⚠️ Known — Docker Desktop on Windows 限制，添加了启动等待脚本 |

### LOW / Cosmetic

| # | Issue | Status |
|---|-------|--------|
| L1 | Windows bash 下 curl JSON 转义问题 (需使用 `-d @file` 方式) | ✅ Documented |

---

## Previous QA Fixes Confirmed Working

| # | Issue | Status |
|---|-------|--------|
| P1 | 内置策略删除返回 403 (原为 401) | ✅ Verified |
| P2 | 策略引擎 target==0 误判 | ✅ Verified |
| P3 | 扫描重复运行时旧记录未清理 | ✅ Verified — 批量删除 |
| P4 | StrategyFormPage 未使用的 import | ✅ Verified |
| P5 | Pydantic Literal 类型校验 | ✅ Verified |

---

## Test Results

### Backend Tests: 88/88 PASSED (8.98s)

- 28 API 端点测试 (strategies, watchlist, news, auth, glossary, signals, patterns)
- 23 形态检测器测试 (golden-cross, death-cross, hammer, doji, etc.)
- 37 其他测试 (conftest, config, middleware)

### API Endpoint Verification (curl)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/health` | GET | ✅ 200 | |
| `/api/strategies` | GET | ✅ 200 | 5 builtin strategies |
| `/api/strategies/{id}` | GET | ✅ 200 | |
| `/api/strategies` | POST | ✅ 201 | Auth required |
| `/api/strategies/{id}` | PUT | ✅ 200 | Custom only |
| `/api/strategies/{id}` | DELETE | ✅ 204 | Custom only, builtin → 403 |
| `/api/strategies/{id}/scan` | POST | ✅ 200 | |
| `/api/strategies/{id}/runs` | GET | ✅ 200 | |
| `/api/stocks` | GET | ✅ 200 | |
| `/api/news` | GET | ✅ 200 | 3 items |
| `/api/glossary` | GET | ✅ 200 | 31 items |
| `/api/watchlist` | GET/POST/DELETE | ✅ | Auth required |
| `/api/signals` | GET | ✅ 200 | |
| `/api/patterns` | GET | ✅ 200 | |

### Frontend (Verified via API proxy)

| Page | Status |
|------|--------|
| `/strategies` — 策略列表 | ✅ |
| `/strategies/{id}` — 策略详情 | ✅ |
| `/strategies/new` — 创建策略 | ✅ |
| `/strategies/{id}/edit` — 编辑策略 | ✅ |
| 导航栏 "策略" 链接 | ✅ |

---

## Known Limitations

1. **Docker Desktop 稳定性**: Windows Docker Desktop 引擎偶尔 500 Internal Server Error，启动后需等待 1-2 分钟
2. **Browser 可视化测试**: browse 工具不可用 (NEEDS_SETUP)，浏览器验证依赖手动测试
3. **性能**: 策略扫描同步执行 (MVP)，大量股票时可能超时 — 后续可改为后台任务

---

## Ship Readiness: ✅ SHIPPABLE

无阻塞性问题。5 个内置策略正常工作，自定义策略 CRUD 完整，所有回归测试通过。
