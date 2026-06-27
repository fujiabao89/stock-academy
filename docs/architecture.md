# 架构决策记录

## 数据流

```
Baostock 免费 API (默认) / Tushare Pro (备用)
    │
    ▼
数据客户端 (backend/app/data/baostock_client.py / tushare_client.py)
    │  工厂模式: stock_client.py 根据配置选择数据源
    ▼
PostgreSQL (daily_bars 表 — 5207 只 A 股日线)
    │
    ├── 形态匹配引擎 (backend/app/engine/)
    │     PatternDetector.match() → 14 种检测器独立判定
    │     │
    │     ▼
    │   pattern_signals 表
    │
    ├── 策略引擎 (backend/app/services/strategy_engine.py)
    │     条件组合评估 → 全市场扫描
    │     │
    │     ▼
    │   strategy_runs 表
    │
    └── 每日更新调度器 (APScheduler)
          收盘后 17:00 自动拉取最新日线 → 重算 MA + 形态
    │
    ▼
FastAPI REST API
    │
    ├── /api/stocks/*      → K线、搜索、概览
    ├── /api/patterns/*    → 形态详情、触发股票
    ├── /api/strategies/*  → 策略 CRUD、扫描、回测
    ├── /api/news/*        → 财经新闻（AI 摘要）
    ├── /api/auth/*        → JWT 注册/登录
    ├── /api/watchlist/*   → 自选股
    └── /api/glossary/*    → 术语词典
    │
    ▼
React 前端 (Vite + ECharts + Tailwind CSS)
```

## 关键架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 数据源 | **Baostock**（主）/ Tushare（备） | Baostock 免费无限流，无需注册；工厂模式一键切换 |
| 数据库迁移 | Alembic | SQLAlchemy 官方迁移工具 |
| 形态匹配架构 | PatternDetector 基类 + registry | 14 种形态独立实现，统一注册和调用 |
| 策略引擎 | 条件 JSON + 全市场扫描 | 灵活的条件组合，复用形态匹配结果 |
| 前端类型 | OpenAPI → TypeScript 自动生成 | 编译器捕获 API 契约变更 |
| 日志 | structlog + correlation_id | 按请求 ID 追踪完整调用链 |
| 配置管理 | Pydantic Settings + .env | 类型安全，环境变量自动映射 |
| 新闻源 | 新浪财经 API（主） | 免费、稳定、每 30 分钟自动抓取 |
| AI 摘要 | DeepSeek API | 新闻批量摘要 + 情感分析 |
| 任务调度 | APScheduler | 新闻抓取（30min）+ K线更新（每日 17:00） |
| 认证 | JWT (python-jose) | 无状态认证，适合容器化部署 |

## 数据模型关系

```
DailyBar (日线数据)
    code + date → 唯一标识一条日线
    包含 OHLCV + MA5/MA20/MA60/MA120

PatternSignal (形态信号)
    code + date + pattern_id → 唯一标识一个形态匹配结果
    包含回测统计 + 白话解释 + 局限性提醒

Strategy (策略定义)
    用户创建的因子/策略
    conditions: JSON 数组，每个条件包含 field/operator/value/pattern_id
    区分内置策略 (is_builtin) 和用户策略

StrategyRun (策略运行结果)
    strategy_id + stock_code → 某策略在某股票上的匹配结果
    每日扫描后更新

User (用户)
    JWT 认证，关联自选股 (user_stocks)

NewsArticle (新闻)
    新浪财经抓取，AI 摘要 + 情感分析
    关联 stock_codes
```

## 服务层架构

```
backend/app/services/
├── strategy_engine.py      # 条件评估 + 全市场扫描
├── strategy_seeds.py       # 5 个内置策略
├── news_crawler.py         # 新浪财经新闻爬虫
├── news_scheduler.py       # APScheduler 配置（新闻 + K线更新）
├── daily_bar_updater.py    # 每日 K 线增量更新
└── ai_summarizer.py        # DeepSeek AI 新闻摘要
```
