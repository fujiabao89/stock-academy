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

## 设计文档

所有 gstack 设计文档位于 `~/.gstack/projects/stock-academy/`。写代码前先查阅相关设计文档。

| 文档 | 说明 | 状态 |
|------|------|:---:|
| `34026-master-design-20260604-170314.md` | Phase 2 设计：用户系统 + 新闻聚合 + AI 解读 + 策略引擎 | APPROVED |
| `34026-master-eng-review-test-plan-20260604-092944.md` | Phase 2 测试计划 | ACTIVE |
| `fujiabao89-master-design-20260531-165200.md` | Phase 1 设计文档 | SUPERSEDED |

**规则**: 收到与 Phase 2 相关的编码任务时，先用 Read 工具读取 `~/.gstack/projects/stock-academy/34026-master-design-20260604-170314.md` 了解完整设计上下文。

## GBrain Configuration

- Engine: PGLite (本地嵌入式 Postgres，无需外部服务)
- Mode: local-stdio (MCP 传输，用户级注册)
- MCP: 已注册 (`claude mcp add --scope user gbrain`)
- Database: `~/.gbrain/brain.pglite`
- Embedding: 未配置（需 OPENAI_API_KEY 或 VOYAGE_API_KEY 以启用语义搜索）
- Status: 已通过冒烟测试（put + search 往返验证通过）

## GBrain Search Guidance (configured by /sync-gbrain)
<!-- gstack-gbrain-search-guidance:start -->

GBrain is set up and synced on this machine. The agent should prefer gbrain
over Grep when the question is semantic or when you don't know the exact
identifier yet.

**This worktree is pinned to a worktree-scoped code source** via the
`.gbrain-source` file in the repo root (kubectl-style context). Any
`gbrain code-def`, `code-refs`, `code-callers`, `code-callees`, or `query`
call from anywhere under this worktree routes to that source by default —
no `--source` flag needed. Conductor sibling worktrees of the same repo
each have their own pin and their own indexed pages, so semantic results
match the actual code on disk in this worktree.

Two indexed corpora available via the `gbrain` CLI:
- This worktree's code (auto-pinned via `.gbrain-source`).
- `~/.gstack/` curated memory (registered as `gstack-brain-<user>` source via
  the existing federation pipeline).

Prefer gbrain when:
- "Where is X handled?" / semantic intent, no exact string yet:
    `gbrain search "<terms>"` or `gbrain query "<question>"`
- "Where is symbol Y defined?" / symbol-based code questions:
    `gbrain code-def <symbol>` or `gbrain code-refs <symbol>`
- "What calls Y?" / "What does Y depend on?":
    `gbrain code-callers <symbol>` / `gbrain code-callees <symbol>`
- "What did we decide last time?" / past plans, retros, learnings:
    `gbrain search "<terms>" --source gstack-brain-<user>`

Grep is still right for known exact strings, regex, multiline patterns, and
file globs. Run `/sync-gbrain` after meaningful code changes; for ongoing
auto-sync across all worktrees, run `gbrain autopilot --install` once per
machine — gbrain's daemon handles incremental refresh on a schedule.

<!-- gstack-gbrain-search-guidance:end -->
