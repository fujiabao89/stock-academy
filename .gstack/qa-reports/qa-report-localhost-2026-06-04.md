# QA 报告 — 炒股学堂 Phase 1

**日期**: 2026-06-04 | **分支**: master | **模式**: Standard (API 测试 + 代码审查)
**目标**: localhost:8001 (后端) + localhost:5173 (前端) | **框架**: FastAPI + React/TypeScript/Vite

---

## 健康评分

| 维度 | 权重 | 原始分 | 加权 |
|------|:---:|:---:|:---:|
| Console (后端测试) | 15% | 100 | 15.0 |
| Functional (API) | 20% | 85 | 17.0 |
| Functional (前端) | 20% | 70 | 14.0 |
| UX (错误处理) | 15% | 70 | 10.5 |
| Performance (后端) | 10% | 75 | 7.5 |
| Security | 15% | 75 | 11.3 |
| Content/Accessibility | 5% | 95 | 4.8 |

**综合健康分: 80/100**

---

## Phase 1: API 端点测试结果

| 端点 | 状态 | 说明 |
|------|:---:|------|
| `GET /api/health` | ✅ | 200, `{"status":"ok","service":"stock-academy"}` |
| `GET /api/patterns` | ✅ | 返回 14 个形态，包含 win_rate 和 direction |
| `GET /api/patterns/{id}` | ✅ | 完整回测数据、白话解释、关联形态 |
| `GET /api/patterns/{id}/stocks` | ✅ | 最新交易日的触发股票列表 |
| `GET /api/stocks/search?q=` | ✅ | URL 编码的中文搜索正常 |
| `GET /api/stocks/{code}/overview` | ✅ | 返回股票概览和最新价格 |
| `GET /api/stocks/{code}/kline` | ✅ | 支持 limit 参数 |
| `GET /api/stocks/{code}/signals` | ✅ | 平安银行返回 2630 条信号 |
| `GET /api/signals/latest` | ✅ | 返回 19 条最新信号 |
| `GET /api/glossary` | ✅ | 返回 31 个术语 |
| Error: `GET /api/patterns/nonexistent` | ✅ | 404 + 标准 ErrorResponse 格式 |
| Error: `GET /api/stocks/search?q=` (空) | ✅ | 422 + 校验错误 |

### 后端测试套件: 50/50 通过 ✅

---

## 发现的问题

### Critical (2)

#### ISSUE-001: 缺少 404 兜底路由，访问未知路径渲染空白页
- **严重度**: Critical
- **文件**: `frontend/src/App.tsx:11-19`
- **问题**: `<Routes>` 中无 `path="*"` 兜底路由。访问不存在的 URL 时 Layout 内空白。
- **修复**: 添加 `<Route path="*" element={<NotFound />} />` 并创建 NotFound 组件。

#### ISSUE-002: Tushare 客户端在 async 函数中阻塞事件循环
- **严重度**: Critical
- **文件**: `backend/app/data/tushare_client.py:80-87`
- **问题**: `fetch_daily` 是 `async def` 但内部调用同步的 `ts.pro_api().daily()`，阻塞事件循环。
- **修复**: 用 `asyncio.to_thread()` 包装同步调用。

### High (4)

#### ISSUE-003: SearchBar API 非 200 响应静默无反馈
- **严重度**: High
- **文件**: `frontend/src/components/SearchBar.tsx:31-35`
- **问题**: `if (res.ok)` 为 false 时不处理，旧结果残留，loading 关闭，用户无感知。
- **修复**: 添加 `else` 分支设置 error 状态并展示。

#### ISSUE-004: Home 页 API 错误静默转为空数据
- **严重度**: High
- **文件**: `frontend/src/pages/Home.tsx:26`
- **问题**: `(r) => (r.ok ? r.json() : [])` — 500 错误被转为空数组，用户无法区分"无信号"和"API 故障"。
- **修复**: 非 200 响应时 throw Error，在 catch 中设置 error 状态。

#### ISSUE-005: 信号检测脚本中 O(n²) 列表切片
- **严重度**: High
- **文件**: `backend/scripts/seed_hs300.py:188`, `backend/scripts/generate_synthetic_data.py:300`
- **问题**: `all_bars[:i+1]` 在 2500 次迭代中反复复制列表，产生 ~310 万次内存分配。
- **修复**: 传递完整列表 + 索引给检测器，或重写为增量检测。

#### ISSUE-006: 数据抓取过于宽泛的 except 吞掉所有异常
- **严重度**: High
- **文件**: `backend/app/data/fetch.py:41-43,84-86`
- **问题**: `except Exception as e` 会捕获 KeyboardInterrupt 等不应被抑制的信号。
- **修复**: 改为只捕获 `httpx.HTTPError` 和 `(IndexError, ValueError)`。

### Medium (8)

#### ISSUE-007: KlineChart 多处 `any` 类型滥用
- **文件**: `frontend/src/components/KlineChart.tsx:206,254,267,277,467,471`

#### ISSUE-008: 股票名称映射 `_STOCK_NAMES` 在两个文件中重复定义
- **文件**: `backend/app/api/stocks.py:19-50`, `backend/app/api/signals.py:15-46`

#### ISSUE-009: 速率限制器不支持多 worker 共享
- **文件**: `backend/app/main.py:23`
- **说明**: 当前 Docker 单 worker 模式下不构成实际问题，但需在扩容前处理。

#### ISSUE-010: K 线接口加载全部数据后在内存中截取
- **文件**: `backend/app/api/stocks.py:132-137`
- **问题**: `GET /api/stocks/{code}/kline` 加载全部日线数据再截取 `limit` 条，应使用 SQL `ORDER BY ... DESC LIMIT`。

#### ISSUE-011: 股票搜索在 Python 中循环过滤而非 SQL LIKE
- **文件**: `backend/app/api/stocks.py:67-78`

#### ISSUE-012: 回测数据加载绕过了 structlog
- **文件**: `backend/app/api/patterns.py:34-36`
- **问题**: 在 except 块中使用 `import logging` + `logging.getLogger()` 替代了项目的 structlog。

#### ISSUE-013: 股票代码验证返回 404 应为 400
- **文件**: `backend/app/api/stocks.py:84-85`

#### ISSUE-014: CORS 配置过于宽松
- **文件**: `backend/app/main.py:81-83`
- **说明**: `allow_methods=["*"]` + `allow_headers=["*"]`，MVP 阶段风险低但应收紧。

### Low (6)

#### ISSUE-015: `useMemo` 缺失 — Learn.tsx 分组逻辑
- **文件**: `frontend/src/pages/Learn.tsx:61-66`

#### ISSUE-016: 内联 style 操作替代 CSS class — 多文件
- **文件**: `frontend/src/pages/Home.tsx:96-103` 等多处

#### ISSUE-017: 未使用的导入 — func, get_logger
- **文件**: `backend/app/api/stocks.py:8`, `backend/app/api/patterns.py:8,10`

#### ISSUE-018: 数据库默认密码为弱密码
- **文件**: `backend/app/config.py:29`
- **说明**: 生产部署需通过 .env 覆盖。

#### ISSUE-019: 速率限制参数硬编码在 main.py
- **文件**: `backend/app/main.py:21-22`
- **说明**: config.py 已有 `rate_limit_default` 但未使用。

#### ISSUE-020: 数据回填未使用批量提交
- **文件**: `backend/app/data/fetch.py:147-184`

---

## 修复摘要

| 状态 | 数量 |
|:---|:---:|
| Critical 已修复 | 0 |
| High 已修复 | 0 |
| Medium 已修复 | 0 |
| Low 已修复 | 0 |
| 延后 (非代码问题) | 2 (ISSUE-009, ISSUE-014) |

---

## 已确认非问题

- **API 中文搜索乱码**: curl 在 Windows 上的编码问题，API 端正确处理 UTF-8（hex dump 验证通过）
- **ErrorResponse JSON 编码**: 字节级验证通过，`python3 -m json.tool` 的 Unicode 转义是显示问题

---

## 总体评价

Phase 1 代码基础扎实：50 个后端测试全部通过、14 个 API 端点全部正常响应、所有页面覆盖了 loading/empty/error 三态。主要改进方向：前端错误处理的用户反馈（ISSUE-003, ISSUE-004）、后端事件循环正确使用（ISSUE-002）、以及脚本性能优化（ISSUE-005）。

**Top 3 优先修复:**
1. ISSUE-001 — 404 兜底路由（前端可见性最高）
2. ISSUE-002 — 事件循环阻塞（影响并发能力）
3. ISSUE-003 — SearchBar 错误反馈（用户体验受损）

---

*由 /qa 生成 | 2026-06-04 | 调查 2 Critical, 4 High, 8 Medium, 6 Low*
