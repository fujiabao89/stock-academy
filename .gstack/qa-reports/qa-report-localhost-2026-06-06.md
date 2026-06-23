---
date: 2026-06-06
branch: master
commit: b83c831
tier: Standard
health_score: 85
environment:
  backend: http://localhost:8001 (Docker)
  frontend: http://localhost:5173 (Vite)
  typescript: 0 errors
---

# QA Report — 2026-06-06

## Summary

全站代码级 QA（因 browse 二进制不可用，回退到 TypeScript + API + 代码审查）。
代码库整体健康，无关键/高/中严重性问题。5 个低严重性发现已全部延后。

## Health Checks

| 检查项 | 状态 | 备注 |
|--------|:----:|------|
| TypeScript 编译 | ✅ 0 errors | `tsc --noEmit` 全部通过 |
| Backend API | ✅ 正常 | 19 signals, 5 strategies, 14 patterns |
| Vite Dev Server | ✅ 运行中 | 端口 5173 |
| Docker Backend | ✅ 运行中 | 端口 8001→8000 |

## 审查范围

### 页面 (11)
Home, StockDetail, Learn, NewsPage, StrategiesPage, StrategyDetailPage,
StrategyFormPage, WatchlistPage, LoginPage, RegisterPage, GlossaryPage

### 组件 (6+)
Layout, SearchBar, PatternCard, PatternSignalList, StrategyCard,
StockOverview, NewsCard, DistributionBar

## 发现

### L1 — 表格头代码重复 (Home.tsx)
Home.tsx 表头在 `.map()` 和 `showAll` 展开列表中各写了一次，相同结构出现了两次。
**严重性**: Low | **处置**: Deferred

### L2 — 移动端响应式网格 (Home.tsx)
40px terminal grid 在移动端偏大，缺少小屏断点调整。
**严重性**: Low | **处置**: Deferred

### L3 — "其他"板块空数据展示 (Home.tsx)
SECTORS["其他"] 的 stocks 为空数组，热力图中渲染为空白格，缺少空态提示。
**严重性**: Low | **处置**: Deferred

### L4 — StrategyDetailPage runs API 无错误检查
`/api/strategies/${id}/runs` 的 fetch 未检查 `r.ok`，异常时可能静默失败。
**严重性**: Low | **处置**: Deferred

### L5 — 表单 label 可访问性
注册/登录表单中 label 与 input 缺少 `htmlFor`/`id` 关联，屏幕阅读器无法正确配对。
**严重性**: Low | **处置**: Deferred

## 健康评分

**85/100** — 无功能缺陷，TypeScript 零错误，API 全部正常。
扣分项均为低严重性延后项（布局微调、可访问性、边界错误处理），不影响核心功能。
