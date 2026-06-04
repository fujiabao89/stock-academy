# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- 项目骨架搭建：FastAPI 后端 + React 前端 + PostgreSQL + Docker Compose
- 8 种 MVP Phase 1 形态检测器（均线排列、金叉死叉、量价关系）
- 行情数据抓取模块（新浪/腾讯免费接口 + fallback 链）
- Alembic 数据库迁移
- structlog 结构化日志 + correlation_id 中间件
- 标准化 API 错误响应格式 `{ error: { code, message, detail } }`
- Makefile 开发命令（setup/dev/test/migrate/rollback/reset-db/new-pattern/seed）
- 文档体系（架构/形态开发/回测指南/故障排查）
- 接入 Tushare 真实行情数据
- 首页"今日值得关注"板块，展示最新触发形态的股票
- Playwright 浏览器测试依赖
- 回测脚本支持 `--seed` 参数固定随机基线
- 形态详情页示例 K线图
- 37 个自动化测试（API + 检测器单元测试）
- GitHub Actions CI（lint + typecheck + test）
- MIT LICENSE

### Changed
- K线形态标注样式改进（arrow 替代 pin，添加标签和边框）
- 胜率模块重构（T1-T10 全部完成）
- API 错误格式统一为 `{ error: { code, message, detail } }`（所有端点）
- 股票代码 404 改进：提示"请输入6位数字代码，如 000001"

### Fixed
- A股红涨绿跌颜色修正
- 看跌形态回测逻辑修正 + 数据库回测数据同步
- 回测数据加载添加异常处理
