# 炒股学堂

**不推荐股票，只教判断方法。** — A 股技术形态教学与因子挖掘工具

搜一只股票 → 看到当前触发了哪些技术形态 → 每个形态有白话解释和历史回测数据 → 基于概率自己判断。创建自定义策略 → 即时回测验证 → 每日自动扫描匹配。

---

## 快速启动

```bash
git clone git@github.com:fujiabao89/stock-academy.git && cd stock-academy
cp .env.example .env
docker compose up -d
```

打开浏览器：
- 前端：http://localhost:5173
- API 文档：http://localhost:8001/docs

---

## 架构

```
浏览器 (React 19 + TypeScript + Vite + ECharts)
    │
    ▼
Backend (:8001) — FastAPI + Uvicorn
    ├── /api/stocks/*      → 股票搜索、K线（含均线）、概览、形态信号
    ├── /api/patterns/*    → 形态教学详情、触发股票列表
    ├── /api/strategies/*  → 策略管理、扫描、回测
    ├── /api/news/*        → A 股财经新闻（AI 摘要 + 情感分析）
    ├── /api/auth/*        → 用户注册/登录（JWT 认证）
    ├── /api/watchlist/*   → 自选股管理
    ├── /api/glossary/*    → 术语词典搜索
    └── /docs              → Swagger UI
    │
    ▼
PostgreSQL 16 (:5433) — 5207 只 A 股 × 最长 10 年日线数据 + 形态信号 + 策略
Redis 7 (:6380) — 速率限制 + 缓存
```

---

## 功能

### K 线图
- ECharts 蜡烛图 + 成交量柱状图
- MA5/MA20/MA60/MA120 均线叠加（可切换）
- BOLL 布林带（上轨/中轨/下轨，可切换）
- 十字光标联动，点击 K 线固定数据窗口
- 鼠标滚轮缩放 + 拖拽平移

### 形态信号（14 种）
- 均线：多头/空头排列、金叉/死叉、均线粘合突破
- K线：锤子线、倒锤子、看涨吞没、看跌吞没、十字星、射击之星
- 量价：放量上涨/下跌、量价背离
- 每个形态：白话解释 + 20 日回测胜率 + 局限性说明 + 关联形态

### 策略引擎
- 5 个内置策略（均线多头+放量、金叉买入、放量突破前高等）
- 每日自动全市场扫描，命中结果存入策略运行记录
- **（计划中）** 因子挖掘工具：自然语言 → 条件 → 即时回测 → 迭代优化

### 用户系统
- JWT 注册/登录
- 自选股管理
- 速率限制

### 新闻聚合
- 新浪财经实时抓取（每 30 分钟）
- AI 摘要 + 情感分析（DeepSeek）
- 股票代码自动关联

### 数据
- **Baostock**（默认）：免费、无需注册、无限流，全市场 5207 只 A 股
- **Tushare**（备用）：需 token，数据维度更丰富
- 历史数据最早到 2019 年，每日收盘后 17:00 自动更新

---

## 14 种形态回测数据

| 形态 | 分类 | 方向 | 20 日胜率 |
|------|------|------|-----------|
| 均线多头排列 | 均线 | 看涨 | 71.5% |
| 放量上涨 | 量价 | 看涨 | 70.0% |
| 量价背离 | 量价 | 看跌 | 69.4% |
| 死叉 | 均线 | 看跌 | 68.9% |
| 射击之星 | K线形态 | 看跌 | 68.1% |
| 看跌吞没 | K线形态 | 看跌 | 67.0% |
| 放量下跌 | 量价 | 看跌 | 66.9% |
| 均线空头排列 | 均线 | 看跌 | 66.4% |
| 十字星 | K线形态 | 中性 | 66.3% |
| 金叉 | 均线 | 看涨 | 65.3% |
| 看涨吞没 | K线形态 | 看涨 | 64.8% |
| 倒锤子 | K线形态 | 看涨 | 64.4% |
| 均线粘合突破 | 均线 | 看涨 | 62.1% |
| 锤子线 | K线形态 | 看涨 | 62.0% |

> 回测区间 2019-2026，全市场 5207 只股票，20 日前瞻窗口，前复权。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 + TypeScript + Vite + ECharts + Tailwind CSS |
| 后端 | Python FastAPI + Uvicorn + APScheduler |
| 数据库 | PostgreSQL 16 + Redis 7 |
| AI | DeepSeek API（新闻摘要 + 情感分析） |
| 数据源 | Baostock（日线） + 新浪财经（新闻） |
| 部署 | Docker Compose（开发） / Render + Docker（生产） |

---

## 开发指南

### 常用命令

```bash
# 启动 / 停止
docker compose up -d
docker compose down

# 数据导入（Baostock 免费无限流）
docker compose exec backend python scripts/seed_hs300.py              # 增量导入全部 A 股
docker compose exec backend python scripts/seed_hs300.py --max-stocks 100  # 限 100 只
docker compose exec backend python scripts/seed_hs300.py --resume        # 断点续传
docker compose exec backend python scripts/seed_hs300.py --source tushare  # 用 Tushare

# 回测
docker compose exec backend python scripts/backtest.py --pattern golden-cross
docker compose exec backend python scripts/backtest.py --all

# 代码检查
docker compose exec backend ruff check app/ scripts/

# 查看日志
docker compose logs -f backend
docker compose logs -f db
```

### 项目结构

```
├── frontend/src/
│   ├── components/
│   │   ├── KlineChart.tsx        # K 线图（ECharts）
│   │   ├── PatternCard.tsx       # 形态卡片
│   │   ├── SearchBar.tsx
│   │   ├── StockOverview.tsx
│   │   └── Layout.tsx
│   ├── pages/
│   │   ├── Home.tsx              # 首页（搜索 + 热门 + 自选）
│   │   ├── StockDetail.tsx       # 个股详情（K 线 / 信号）
│   │   ├── PatternDetailPage.tsx # 形态详情
│   │   ├── NewsPage.tsx          # 新闻列表
│   │   └── StrategiesPage.tsx    # 策略管理
│   └── index.css
├── backend/
│   ├── app/
│   │   ├── api/                  # REST API 路由
│   │   ├── engine/               # 形态检测引擎（14 个检测器）
│   │   │   └── detectors/
│   │   ├── services/             # 策略引擎、新闻爬虫/调度器、AI 摘要、K线更新
│   │   ├── data/                 # Baostock/Tushare 客户端
│   │   ├── auth/                 # JWT 认证
│   │   ├── models/               # SQLAlchemy 模型
│   │   └── schemas/              # Pydantic 响应模型
│   ├── scripts/
│   │   ├── seed_hs300.py         # 全市场历史数据导入
│   │   └── backtest.py           # 形态回测
│   └── tests/
├── docs/                         # 项目文档
├── docker-compose.yml
└── .env.example
```

---

## 约束

- 不写"买入""卖出""推荐" — 始终用概率语言
- 数据源：Baostock 免费日线（无需注册），Tushare 备用

---

## 文档索引

| 文档 | 说明 |
|------|------|
| [架构决策记录](docs/architecture.md) | 数据流、关键架构决策、数据模型 |
| [形态检测器开发](docs/pattern-development.md) | 如何添加新形态 |
| [回测操作指南](docs/backtest-guide.md) | 回测方法论和命令 |
| [策略因子实验室](docs/strategy-factor-lab.md) | 因子挖掘工具设计（计划中） |
| [故障排查](TROUBLESHOOTING.md) | 常见问题和修复 |
