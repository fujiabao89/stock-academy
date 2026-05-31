# 架构决策记录

## 数据流

```
外部行情 API (新浪/腾讯/Tushare)
    │
    ▼
数据抓取模块 (backend/app/data/fetch.py)
    │
    ▼
PostgreSQL (daily_bars 表)
    │
    ▼
形态匹配引擎 (backend/app/engine/)
    │  PatternDetector.match() → 判定是否触发形态
    │  8 种检测器按日线序列独立判定
    ▼
pattern_signals 表
    │
    ▼
FastAPI REST API (/api/stocks/{code}/signals)
    │
    ▼
React 前端 (ECharts K线图 + 教学卡片)
```

## 关键架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 数据库迁移 | Alembic | SQLAlchemy 官方迁移工具，支持 autogenerate |
| 连接池 | SQLAlchemy QueuePool (pool=10, overflow=20) | 全市场扫描批量操作需要足够连接 |
| 形态匹配架构 | PatternDetector 基类 + registry 注册机制 | 8 种形态独立实现，通过 registry 统一注册和调用 |
| 前端类型同步 | FastAPI OpenAPI → TypeScript 类型自动生成 | 编译器捕获 API 契约 breaking change |
| 日志 | structlog + correlation_id 中间件 | grep 一个 ID 即可追踪完整调用链 |
| 配置管理 | Pydantic Settings + .env | 类型安全的配置，环境变量自动映射 |
| 数据源容错 | 新浪 → 腾讯 fallback 链，单点超时不重试 | 免费接口不稳定，但单点失败不阻塞全市场扫描 |
| 前端包体积 | ECharts 按需引入 + React Router 懒加载 | 减少首屏 JS 体积 |
| 反向代理 | Nginx | 统一入口，前后端同域部署 |

## 数据模型关系

```
DailyBar (日线数据)
    code + date → 唯一标识一条日线
    包含 OHLCV + MA5/MA20/MA60/MA120

PatternSignal (形态信号)
    code + date + pattern_id → 唯一标识一个形态匹配结果
    包含回测统计 + 白话解释 + 局限性提醒
```
