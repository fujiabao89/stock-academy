# 炒股学堂

**不推荐股票，只教判断方法。** — A 股技术形态教学工具

搜一只股票 → 看到该股票当前触发了哪些技术形态 → 每个形态旁边有白话解释和历史回测数据 → 基于概率自己判断。

在线体验：https://stock-academy.onrender.com

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
浏览器 (React + Vite + ECharts)
    │
    ▼
Backend (:8001) — FastAPI + Uvicorn
    ├── /api/stocks/*   → 股票搜索、K线（含均线）、概览、形态信号
    ├── /api/patterns/* → 形态教学详情、触发股票列表
    ├── /api/glossary/* → 术语词典搜索
    └── /docs           → Swagger UI
    │
    ▼
PostgreSQL (:5433) — 日线数据 + 形态信号（30 只沪深300 × 2500 天）
```

### 部署架构

```
Render (Docker)
    ├── Nginx → dist/ 静态资源
    ├── FastAPI → PostgreSQL (Render Managed)
    └── start.sh → 自动建表 + 种子数据
```

---

## 功能

### K 线图
- ECharts 蜡烛图 + 成交量柱状图 + MACD 面板
- MA5/MA20/MA60/MA120 均线叠加（可切换）
- BOLL 布林带（上轨/中轨/下轨，可切换）
- 十字光标联动，点击 K 线固定数据窗口（显示完整 OHLC + 技术指标）
- 鼠标滚轮缩放 + 拖拽平移

### 形态信号
- 8 种技术形态实时检测：金叉/死叉、多头/空头排列、放量涨/跌、量价背离、均线粘合突破
- 每个形态包含：白话解释、20 日历史回测胜率、局限性说明、关联形态
- 搜索支持代码和中文名称模糊匹配

### 响应式适配
- 桌面端 / 移动端自适应布局
- K 线图高度、间距随屏幕尺寸自动调整

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | React 19 + TypeScript + Vite | ECharts K 线图、形态卡片、搜索 |
| 后端 | Python FastAPI + Uvicorn | REST API、形态检测引擎 |
| 数据库 | PostgreSQL 16 | 日线数据 + 形态信号 |
| 部署 | Render + Docker | 多阶段构建（Node → Python），自动部署 |
| 开发 | Docker Compose | 一键启动全栈 |

---

## 8 种形态（已实现 + 回测验证）

| 形态 | 分类 | 方向 | 20 日胜率 |
|------|------|------|-----------|
| 均线多头排列 | 均线 | 看涨 | 73.4% |
| 放量上涨 | 量价 | 看涨 | 71.6% |
| 量价背离 | 量价 | 看跌 | 73.0% |
| 均线粘合向上发散 | 均线 | 看涨 | 65.0% |
| 金叉 (MA5 上穿 MA20) | 均线 | 看涨 | 67.3% |
| 死叉 (MA5 下穿 MA20) | 均线 | 看跌 | — |
| 均线空头排列 | 均线 | 看跌 | — |
| 放量下跌 | 量价 | 看跌 | — |

> 胜率数据基于 2016-2026 年 30 只沪深300 成分股合成数据回测，20 日前瞻窗口。

---

## 开发指南

### 常用命令

```bash
# Docker Compose
docker compose up -d                         # 启动全栈开发环境
docker compose exec backend python scripts/generate_synthetic_data.py  # 重新生成合成数据
docker compose down -v                       # 清理容器和卷

# 代码检查
docker compose exec backend ruff check app/ scripts/

# 测试
docker compose exec backend pytest tests/ -v

# 回测
docker compose exec backend python scripts/backtest.py --pattern golden-cross
docker compose exec backend python scripts/backtest.py --all
docker compose exec backend python scripts/backtest.py --pattern golden-cross --start 2015-01-01 --end 2025-12-31 --seed 42
```

### 添加新形态

1. 创建 `backend/app/engine/detectors/new_pattern.py` — 继承 `PatternDetector`，实现 `match()` 方法
2. 在文件末尾调用 `register(NewPattern())` 注册
3. 在 `backend/scripts/generate_synthetic_data.py` 的 `_BACKTEST_DATA`、`_DETERMINATIONS`、`_RELATED` 中添加对应条目
4. 在 `backend/app/api/patterns.py` 的 `_BACKTEST_DATA` 中补充回测数据
5. 运行回测验证胜率

### 项目结构

```
├── frontend/src/
│   ├── components/
│   │   ├── KlineChart.tsx      # K 线图（ECharts，含 MACD/BOLL）
│   │   ├── PatternCard.tsx     # 形态卡片
│   │   ├── PatternSignalList.tsx
│   │   ├── SearchBar.tsx
│   │   ├── StockOverview.tsx
│   │   └── Layout.tsx
│   ├── pages/
│   │   ├── Home.tsx            # 首页（搜索 + 热门股票）
│   │   └── StockDetail.tsx     # 个股详情（概览 + K 线 / 信号 Tab）
│   └── index.css               # 设计系统（CSS 变量 + 响应式断点）
├── backend/
│   ├── app/
│   │   ├── api/                # REST API 路由
│   │   ├── engine/             # 形态检测引擎
│   │   │   └── detectors/      # 8 个形态检测器
│   │   ├── models/             # SQLAlchemy 模型
│   │   └── schemas/            # Pydantic 响应模型
│   └── scripts/
│       └── generate_synthetic_data.py  # 合成数据生成器
├── docker-compose.yml
├── Dockerfile.prod             # 生产环境多阶段构建
├── render.yaml                 # Render Blueprint 部署配置
└── start.sh                    # 启动脚本（建表 + 种子数据）
```

---

## 约束

- 不写"买入""卖出""推荐"字样 — 始终用概率语言
- MVP 不做用户系统（无登录、无自选股、无推送）
- 数据源：合成数据生成器（仿真 30 只沪深300 成分股 10 年历史）

---

## 故障排查

### 端口冲突

```bash
# 检查 5433/6380/8001/5173 端口占用
docker compose ps
lsof -i :5433

# 更换端口：复制 .env.example 到 .env，修改端口映射
cp .env.example .env
# 编辑 .env 中的 *_PORT 变量
```

### 数据库连接失败

```bash
# 等待 PostgreSQL 就绪后重启 backend
docker compose restart backend

# 查看数据库日志
docker compose logs db
```

### Docker 镜像构建慢

```bash
# 使用国内 pip 镜像（Dockerfile 已配置清华源）
# 如构建仍慢，检查 Docker Desktop 网络代理设置

# 清理构建缓存重试
docker compose build --no-cache backend
```

### 前端页面空白

```bash
# 检查前端构建输出
docker compose logs frontend

# 确认 API 可访问
curl http://localhost:8001/api/health
```

### 数据为空

```bash
# 重新生成种子数据
docker compose exec backend python scripts/generate_synthetic_data.py --num-stocks 30 --days 2500
```
