# CLAUDE.md

## Deploy Configuration (configured by /setup-deploy)

- Platform: fly.io
- Production URL: {app-name}.fly.dev (应用名称待项目启动后补充)
- Deploy workflow: auto-deploy on push to main (需要 fly.toml)
- Deploy status command: fly status --app {app}
- Merge method: squash
- Project type: web app
- Post-deploy health check: /

### Custom deploy hooks

- Pre-merge: none
- Deploy trigger: automatic on push to main (via fly.io GitHub integration 或 `fly deploy`)
- Deploy status: fly status --app {app}
- Health check: {app-name}.fly.dev/

### Notes

- fly CLI 尚未安装，部署前需安装：`brew install flyctl` (macOS) 或 `curl -L https://fly.io/install.sh | sh` (Linux)
- 项目当前为空白状态，`{app-name}` 需在创建 Fly.io 应用后替换为实际名称
- 后续运行 `/setup-deploy` 可更新配置

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

## GBrain Configuration

- Engine: PGLite (本地嵌入式 Postgres，无需外部服务)
- Mode: local-stdio (MCP 传输，用户级注册)
- MCP: 已注册 (`claude mcp add --scope user gbrain`)
- Database: `~/.gbrain/brain.pglite`
- Embedding: 未配置（需 OPENAI_API_KEY 或 VOYAGE_API_KEY 以启用语义搜索）
- Status: 已通过冒烟测试（put + search 往返验证通过）

### GBrain Search Guidance

当需要搜索项目知识库、查找历史决策、或检索之前存储的上下文时：
- 使用 gbrain MCP 工具进行搜索（`gbrain_search`）
- 写入知识时使用 `gbrain_put` 工具
- gbrain 适合存储：设计决策、架构讨论、Bug 分析、会议记录等长期知识
- 不适合存储：临时调试信息、一次性脚本输出、已在 git 中记录的内容
