# GStack 命令使用顺序与注释

---

## 阶段一：环境搭建（一次性）

| 顺序 | 命令 | 说明 |
|------|------|------|
| 1 | `/gstack` | gstack 系统入口，查看版本、状态、配置概览 |
| 2 | `/gstack-upgrade` | 升级 gstack 到最新版本 |
| 3 | `/setup-deploy` | 配置部署参数（为 `/land-and-deploy` 做准备） |
| 4 | `/setup-browser-cookies` | 从真实 Chromium 导入 Cookies 到无头浏览器 |
| 5 | `/setup-gbrain` | 设置 gbrain：安装 CLI，初始化知识库 |
| 6 | `/sync-gbrain` | 将仓库代码同步到 gbrain 知识库，刷新搜索索引 |

---

## 阶段二：项目启动 → 想法阶段

| 顺序 | 命令 | 说明 |
|------|------|------|
| 1 | `/office-hours` | YC 办公时间模式：产品想法评估、创业诊断 |
| 2 | `/spec` | 将模糊想法转化为精确可执行的规格文档（五阶段流程） |

---

## 阶段三：规划审查（Plan Review）

| 顺序 | 命令 | 说明 |
|------|------|------|
| 1 | `/plan-tune` | 自我调优：学习你的提问偏好和开发者画像（建议最先跑） |
| 2 | `/plan-ceo-review` | CEO 视角：验证产品策略、市场需求、范围合理性 |
| 3 | `/plan-design-review` | 设计师视角：审查交互设计、用户体验方案 |
| 4 | `/plan-eng-review` | 工程经理视角：评估架构合理性、技术选型、复杂度 |
| 5 | `/plan-devex-review` | 开发者体验审查：开发流程、工具链、CI/CD |
| 6 | `/autoplan` | 全自动流水线：依次运行 CEO → 设计 → 工程 → DX |

> **使用建议**：对于重要功能，先用 `/autoplan` 跑一遍自动审查，再针对薄弱环节单独调用对应的 plan 命令深挖。

---

## 阶段四：设计与视觉（Design）

| 顺序 | 命令 | 说明 |
|------|------|------|
| 1 | `/design-consultation` | 设计咨询：竞品研究 → 美学体系 → 字体/颜色/布局/动效 |
| 2 | `/design-shotgun` | 设计发散：生成多种 AI 设计变体，并排对比，收集反馈迭代 |
| 3 | `/design-html` | 设计落地：生成生产级原生 HTML/CSS |
| 4 | `/design-review` | 设计师视角 QA：发现间距/层级/AI 痕迹并修复 |

> **使用建议**：先 `/design-consultation` 定方向，再用 `/design-shotgun` 产出多方案，选定后 `/design-html` 落地，最后 `/design-review` 打磨。

---

## 阶段五：开发 → 编码实现

| 顺序 | 命令 | 说明 |
|------|------|------|
| 1 | `/context-restore` | 恢复之前保存的工作上下文（继续上次的工作） |
| 2 | `/skillify` | 将最近成功的操作流程固化为永久技能 |

---

## 阶段六：代码审查与质量（Review & QA）

| 顺序 | 命令 | 说明 |
|------|------|------|
| 1 | `/review` | 合入前 PR 审查（多代理：架构 + Bug + 安全） |
| 2 | `/cso` | 首席安全官模式：OWASP Top 10 + STRIDE 安全审计 |
| 3 | `/qa` | Web 应用 QA 测试：发现问题并自动修复 |
| 4 | `/qa-only` | 纯报告模式 QA：只发现问题，不修复（适合外部审计） |
| 5 | `/devex-review` | 实时开发者体验审计 |
| 6 | `/health` | 代码质量仪表盘：技术债务、覆盖率、复杂度一览 |
| 7 | `/benchmark` | 浏览器性能回归检测 |
| 8 | `/benchmark-models` | 跨模型技能基准测试 |

> **使用建议**：PR 前至少跑 `/review` + `/qa`。涉及认证/支付/敏感数据时加跑 `/cso`。

---

## 阶段七：调试与调查

| 顺序 | 命令 | 说明 |
|------|------|------|
| 1 | `/investigate` | 系统性调试，追踪根本原因（非表面症状） |
| 2 | `/retro` | 每周工程回顾（支持跨项目全局模式） |

---

## 阶段八：发布上线（Ship & Deploy）

| 顺序 | 命令 | 说明 |
|------|------|------|
| 1 | `/context-save` | 保存当前工作上下文（发布前存档） |
| 2 | `/ship` | 发布工作流：合并基分支 → 测试 → 审查差异 → 更新版本号 → CHANGELOG → 提交 → 创建 PR |
| 3 | `/land-and-deploy` | 合并并部署：merge → deploy → canary 验证 |
| 4 | `/landing-report` | 只读队列仪表盘：查看 workspace-aware ship 状态 |
| 5 | `/canary` | 部署后金丝雀监控，观察线上指标 |
| 6 | `/document-release` | 发布后文档更新 |

---

## 阶段九：文档（贯穿全流程）

| 顺序 | 命令 | 说明 |
|------|------|------|
| - | `/document-generate` | 从零为功能/模块/项目生成文档 |
| - | `/learn` | 管理项目学习笔记和知识积累 |

> 这两个命令无固定顺序，按需随时使用。

---

## 阶段十：安全与权限控制

| 命令 | 说明 |
|------|------|
| `/guard` | 完整安全模式：破坏性命令警告 + 目录范围编辑限制 |
| `/freeze` | 限制文件编辑范围到指定目录 |
| `/unfreeze` | 解除 `/freeze` 限制 |
| `/careful` | 破坏性命令安全护栏 |

---

## 浏览器相关（按需）

| 命令 | 说明 |
|------|------|
| `/browse` | 快速无头浏览器 QA 测试 |
| `/open-gstack-browser` | 启动 AI 控制的 Chromium（内置侧边栏扩展） |
| `/connect-chrome` | `/open-gstack-browser` 的别名 |
| `/scrape` | 网页数据抓取 |
| `/make-pdf` | Markdown → 专业品质 PDF |
| `/pair-agent` | 将远程 AI 代理与浏览器配对 |

---

## iOS 相关（按需）

| 命令 | 说明 |
|------|------|
| `/ios-qa` | 真机 iOS QA 测试（SwiftUI） |
| `/ios-fix` | 自动修复 iOS Bug |
| `/ios-design-review` | iOS 应用真机视觉审计 |
| `/ios-clean` | 移除 DebugBridge SPM 包和 `#if DEBUG` 代码 |
| `/ios-sync` | 重新生成 iOS 调试桥接 |

---

## 典型场景速查

```
新项目启动：
  /gstack → /plan-tune → /office-hours → /spec → /autoplan

功能开发：
  /context-restore → [编码] → /review → /qa → /ship

Bug 修复：
  /investigate → [修复] → /review → /qa-only → /ship

设计重做：
  /design-consultation → /design-shotgun → /design-html → /design-review

部署上线：
  /context-save → /ship → /land-and-deploy → /canary → /document-release

安全审计：
  /cso → /qa-only → [修复] → /review

iOS 开发：
  /ios-qa → /ios-fix → /ios-design-review → /ios-clean → /ios-sync
```
