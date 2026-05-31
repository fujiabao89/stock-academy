# TODOS

待办事项，按优先级排列。由 /plan-eng-review + /plan-devex-review 于 2026-05-31 生成。

---

## P0 — 项目骨架（阻塞所有后续开发）

- [ ] **项目骨架搭建：Docker Compose + Makefile + 版本锁定 + .env 自动生成**
  - 文件：Makefile, .env.example, .python-version, .nvmrc, docker-compose.yml, Dockerfile
  - 来源：/plan-devex-review DX1

- [ ] **README：3步快速启动 + 项目简介 + ASCII 架构图**
  - 来源：/plan-devex-review DX2

- [ ] **预填 30 只沪深300 种子数据（2年日线），docker compose up 自动加载**
  - 来源：/plan-devex-review DX3

---

## P1 — 开发体验核心

- [ ] **标准化 ErrorResponse schema + FastAPI 全局 exception handlers**
  - { error: { code, message, detail } }，前端只需处理一种错误格式
  - 来源：/plan-devex-review DX4

- [ ] **请求 correlation_id 中间件 + structlog 自动注入**
  - grep correlation_id 即可追踪完整调用链
  - 来源：/plan-devex-review DX5

- [ ] **文档体系：架构文档 + 形态开发指南 + 回测指南 + 故障排查 + CHANGELOG**
  - docs/architecture.md, docs/pattern-development.md, docs/backtest-guide.md, TROUBLESHOOTING.md, CHANGELOG.md
  - 来源：/plan-devex-review DX6

---

## P2 — 后续迭代

- [ ] **API 速率限制**
  - 问题：MVP 无用户系统，API 端点完全开放，可能被滥用消耗外部行情 API 配额
  - 方案：FastAPI + slowapi 中间件，IP-based，30 req/min/IP
  - 触发条件：外部 API 配额告警 或 用户量 >100
  - 依赖：无
  - 来源：/plan-eng-review 架构审查 #1

- [ ] **make new-pattern 脚手架命令（生成 detector + test + backtest 骨架）**
  - make new-pattern id=<id> 一键生成标准结构
  - 来源：/plan-devex-review DX7

- [ ] **Makefile 封装 Alembic：make migrate / make rollback / make reset-db**
  - 来源：/plan-devex-review DX8
