# 炒股学堂

**不推荐股票，只教判断方法。** — A 股教学工具

搜一只股票 → 看到该股票当前触发了哪些技术形态 → 每个形态旁边有白话解释和历史回测数据 → 基于概率自己判断。

---

## 快速启动

```bash
# 1. 克隆仓库
git clone git@github.com:fujiabao89/stock-academy.git && cd stock-academy

# 2. 复制环境变量配置
cp .env.example .env

# 3. 启动开发环境
docker compose up -d
```

打开浏览器：
- 前端：http://localhost:5173
- API 文档：http://localhost:8001/docs

---

## 架构

```
浏览器 (React + Vite)
    │
    ▼
Backend (:8001) — FastAPI + Uvicorn
    ├── /api/stocks/*   → 股票搜索、K线、概览
    ├── /api/patterns/* → 形态教学详情、触发股票
    ├── /api/glossary/* → 术语词典搜索
    └── /docs           → Swagger UI
    │
    ▼
├── PostgreSQL (:5433)   历史日线数据 + 形态信号 (71,777 条)
└── Redis (:6380)        缓存（可选）
```

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | React 19 + TypeScript + Vite | 形态展示、K线图、搜索（待开发） |
| 后端 | Python FastAPI + Uvicorn | REST API、形态匹配引擎 |
| 数据库 | PostgreSQL 16 | 日线数据 + 形态信号存储 |
| 缓存 | Redis 7 | 形态匹配结果缓存（可选） |
| 部署 | Docker Compose | 一键启动全栈 |

---

## 开发指南

### 常用命令

```bash
# Docker Compose
docker compose up -d          # 启动全栈开发环境
docker compose exec backend python scripts/backtest.py --all          # 运行回测
docker compose exec backend python scripts/run_pattern_match.py       # 盘后形态匹配
docker compose exec backend python scripts/generate_synthetic_data.py # 生成合成数据
docker compose down -v        # 清理容器和卷

# 数据库迁移
docker compose exec backend alembic upgrade head
docker compose exec backend alembic revision --autogenerate -m "描述"

# 代码检查
docker compose exec backend ruff check app/ scripts/
```

### 添加新形态

1. 创建 `backend/app/engine/detectors/new_pattern.py` — 继承 `PatternDetector`，实现 `match()` 方法
2. 在文件末尾调用 `register(NewPattern())` 注册
3. 编写测试
4. 运行回测验证胜率

详见 `docs/pattern-development.md`。

---

## 8 种形态（已实现 + 回测验证）

| 形态 | 分类 | 方向 | 20日胜率 |
|------|------|------|----------|
| 均线多头排列 | 均线 | 看涨 | 73.4% |
| 放量上涨 | 量价 | 看涨 | 71.6% |
| 量价背离 | 量价 | 看跌 | 73.0% |
| 均线粘合向上发散 | 均线 | 看涨 | 65.0% |
| 金叉 (MA5 上穿 MA20) | 均线 | 看涨 | 67.3% |
| 死叉 (MA5 下穿 MA20) | 均线 | 看跌 | — |
| 均线空头排列 | 均线 | 看跌 | — |
| 放量下跌 | 量价 | 看跌 | — |

> 胜率数据基于 2016-2026 年 30 只沪深300 成分股真实数据回测，20 日前瞻窗口。

---

## 约束

- 不写"买入""卖出""推荐"字样 — 始终用概率语言
- MVP 不做用户系统（无登录、无自选股、无推送）
- 数据源：Tushare Pro 历史数据 + 合成数据生成器
