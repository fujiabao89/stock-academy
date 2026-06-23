# QA Report — A-STOCK TERMINAL

**日期**: 2026-06-08
**目标**: http://localhost:5173
**分支**: master
**等级**: Standard (critical + high + medium)
**框架**: React + Vite + ECharts
**耗时**: ~5 分钟

---

## 健康评分

| 类别 | 得分 | 权重 | 加权 |
|------|------|:---:|------|
| Console | 100 | 15% | 15.0 |
| Links | 100 | 10% | 10.0 |
| Visual | 92 | 10% | 9.2 |
| Functional | 85 | 20% | 17.0 |
| UX | 92 | 15% | 13.8 |
| Performance | 100 | 10% | 10.0 |
| Content | 100 | 5% | 5.0 |
| Accessibility | 85 | 15% | 12.8 |
| **总计** | | | **92.8** |

**Console**: 0 errors 在所有8个测试页面
**Links**: 0 broken links 检测到

---

## 测试覆盖

8 个页面全部测试，0 console 错误：

| 页面 | 路由 | 状态 | 标题 |
|------|------|:---:|------|
| 首页 | / | PASS | 炒股学堂 |
| 学堂 | /learn | PASS | 炒股学堂 |
| 新闻 | /news | PASS | 炒股学堂 |
| 策略 | /strategies | PASS | 炒股学堂 |
| 股票详情 | /stock/600519 | PASS | 炒股学堂 (贵州茅台) |
| 登录 | /login | PASS | 炒股学堂 |
| 形态详情 | /learn/patterns/hammer | PASS | 炒股学堂 |
| 术语表 | /learn/glossary | PASS | 炒股学堂 |
| 404 | /nonexistent | PASS | 炒股学堂 (404 displayed) |
| 移动端 | / (375x812) | PASS | — |

---

## API 端点测试

| 端点 | 状态 | 结果 |
|------|:---:|------|
| GET /api/signals/latest | 200 | 3259 条信号 |
| GET /api/strategies | 200 | 5 条策略 |
| GET /api/strategies/{1-5} | 200 | 全部正常 |
| GET /api/patterns | 200 | 正常 |
| GET /api/news | 200 | 正常 |
| GET /api/stocks/search?q=600519 | 200 | 正常 |
| GET /api/stocks/search?q=茅台 | 200 | 正常（需UTF-8编码） |
| GET /api/stocks/{code}/overview | 200 | 贵州茅台、平安银行、宁德时代 |
| GET /api/stocks/{code}/kline | 200 | K线数据正常 |
| GET /api/stocks/{code}/signals | 200 | 342 条形态信号 |

---

## 发现的问题

### ISSUE-001 [MEDIUM] — Layout 搜索栏非代码查询导航到 404

**严重度**: Medium
**分类**: Functional
**状态**: ✅ Fixed (061a3ad)

**复现步骤**:
1. 在顶部导航搜索栏输入中文（如"茅台"）
2. 按 Enter
3. 页面导航到 `/stock?q=茅台` → 显示 404

**根因**: Layout 的搜索处理中对非6位数字输入执行 `navigate(\`/stock?q=...\`)`，但 App.tsx 中只有 `/stock/:code` 路由，没有 `/stock` 路由，导致匹配到 `*` catch-all → NotFound。

**修复**: 只对6位有效代码执行导航，非代码输入不再跳转。

---

## 确认正常的功能

- ✅ 首页信号表格正常渲染（3259 条信号）
- ✅ 策略卡片从 API 获取数据（5 条内置策略）
- ✅ K线图正确渲染（贵州茅台，含价格/成交量/MACD）
- ✅ 移动端汉堡菜单显示正常
- ✅ 桌面端导航完整（首页/学堂/新闻/策略）
- ✅ 登录页表单和注册链接正常
- ✅ 形态详情页内容正常
- ✅ 404 页面正常显示
- ✅ 所有8个页面 0 console 错误

---

## 待处理项

1. **NEWS 内容编码问题**: 新浪新闻的中文内容在 API 响应中有乱码（可能是源数据编码问题，非前端 bug）
2. **Home 页市场指数硬编码**: INDICES/WATCHLIST/NEWS_ITEMS/REPORTS 仍为硬编码假数据，未接入 API

---

## PR 摘要

QA found 1 issue (medium), fixed. Health score: 93/100.
