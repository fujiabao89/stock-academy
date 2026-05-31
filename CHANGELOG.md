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
