# 炒股学堂

**不推荐股票，只教判断方法。** — A 股教学工具

搜一只股票 → 看到该股票当前触发了哪些技术形态 → 每个形态旁边有白话解释和历史回测数据 → 基于概率自己判断。

---

## 快速启动

```bash
# 1. 克隆仓库
git clone <repo-url> && cd stock-academy

# 2. 生成配置并构建
make setup

# 3. 启动开发环境
make dev
```

打开浏览器：
- 前端：http://localhost:5173
- API 文档：http://localhost:8000/docs

---

## 架构

```
浏览器 (React + ECharts)
    │
    ▼
Nginx (:80)
    ├── /          → Frontend (:5173)   Vite dev server
    ├── /api/*     → Backend (:8000)    FastAPI + Uvicorn
    └── /docs      → Backend (:8000)    Swagger UI
    │
    ▼
Backend (Python FastAPI)
    ├── PostgreSQL (:5432)   历史日线数据 + 形态信号
    └── Redis (:6379)        缓存（MVP 可选）
```

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | React 19 + TypeScript + ECharts 5 | K 线图渲染、形态标注展示 |
| 后端 | Python FastAPI + Uvicorn | REST API、形态匹配引擎 |
| 数据库 | PostgreSQL 16 | 日线数据 + 形态信号存储 |
| 缓存 | Redis 7 | 形态匹配结果缓存（可选） |
| 部署 | Docker Compose + Nginx | 一键启动全栈 |

---

## 开发指南

### 常用命令

```bash
make dev          # 启动全栈开发环境
make test         # 运行后端测试
make lint         # 代码检查（ruff + tsc）
make migrate msg='描述'  # 生成并执行数据库迁移
make rollback     # 回滚最近一次迁移
make reset-db     # 重建数据库 + 种子数据
make seed         # 填充种子数据
make new-pattern id=my-pattern  # 生成新形态检测器骨架
make clean        # 清理容器和卷
```

### 添加新形态

1. `make new-pattern id=volume-breakout`
2. 编辑 `backend/app/engine/detectors/volume_breakout.py` — 实现 `match()` 方法
3. 在 `backend/app/engine/registry.py` 或应用启动中注册
4. 编写测试 `backend/tests/engine/test_volume_breakout.py`
5. 运行回测验证 precision/recall

详见 `docs/pattern-development.md`。

---

## 首批形态（MVP Phase 1）

| 形态 | 分类 | 方向 |
|------|------|------|
| 均线多头排列 | 均线 | 看涨 |
| 均线空头排列 | 均线 | 看跌 |
| 金叉 (MA5 上穿 MA20) | 均线 | 看涨 |
| 死叉 (MA5 下穿 MA20) | 均线 | 看跌 |
| 放量上涨 | 量价 | 看涨 |
| 放量下跌 | 量价 | 看跌 |
| 均线粘合向上发散 | 均线 | 看涨 |
| 量价背离 | 量价 | 看跌 |

---

## 约束

- 不写"买入""卖出""推荐"字样 — 始终用概率语言
- MVP 不做用户系统（无登录、无自选股、无推送）
- 数据源：新浪/腾讯免费接口（Tushare 备选）
