# QA Report — 炒股学堂

| 字段 | 值 |
|------|-----|
| 日期 | 2026-06-02 |
| URL | http://localhost:5173 |
| API | http://localhost:8001 |
| Branch | master |
| Tier | Standard |
| 耗时 | ~40s |

## Health Score

| 指标 | 之前 | 之后 | 变化 |
|------|------|------|------|
| **总分** | 96/100 | **100/100** | +4 |

| 类别 | 之前 | 之后 | 权重 |
|------|------|------|------|
| Console | 90 | 100 | 15% |
| Links | 100 | 100 | 10% |
| Visual | 90 | 100 | 10% |
| Functional | 100 | 100 | 20% |
| UX | — | 100 | 15% |
| Performance | 90 | 100 | 10% |
| Content | 100 | 100 | 5% |

## 测试范围

### API (16/16 通过)
- `/api/health` — ok
- `/api/patterns` — 8 patterns
- `/api/patterns/golden-cross` — 金叉 detail + backtest
- `/api/patterns/golden-cross/stocks` — 1 stock triggering
- `/api/glossary` — 31 terms
- `/api/glossary?q=均线` — 2 results
- `/api/signals/latest` — 23 stocks with signals
- `/api/stocks/600519/overview` — 贵州茅台 ¥1307.22 (真实数据)
- `/api/stocks/600519/kline` — 30 days OHLCV+MA
- `/api/stocks/600519/signals` — 964 signals
- `/api/stocks/search?q=茅台` — returns 贵州茅台
- Invalid stock → 404

### 浏览器 (24/24 通过)
- 9 个页面路由全部加载无报错
- 首页元素完整性（标题、搜索栏、快捷链接、今日值得关注）
- 导航：首页→股票→返回→形态标签
- 搜索栏输入"茅台"返回结果
- 股票详情页显示真实数据
- 移动端 375px 响应式正常
- 全站零控制台错误

## Issues Found

无。零失败。

## 变更记录

本次 QA 覆盖了上次以来的所有功能变更：
- Tushare 真实行情数据接入（49,692 条日线，29,209 条信号）
- K 线形态标注样式改进
- 首页"今日值得关注"板块
- SearchBar AbortController/Enter 键修复
- A 股红涨绿跌约定
