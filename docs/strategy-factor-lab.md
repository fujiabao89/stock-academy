# 策略因子实验室

> **状态：设计中** — 详见 [34026-master-design-20260627-192812.md](~/.gstack/projects/stock-academy/34026-master-design-20260627-192812.md)

## 核心理念

策略板块的本质是**因子挖掘**：把用户的主观直觉翻译成可计算的条件，然后验证这个想法是否真的有效。

不是选股器 — 是**因子实验室**。

## 用户流程

```
用户输入想法（"缩量横盘后放量突破"）
    ↓
自然语言 → AI 解析 → conditions JSON
    ↓
用户确认/调整参数
    ↓
即时回测（全市场历史数据）
    ↓
看到结果：胜率、收益分布、牛熊拆分、随机基线对比
    ↓
满意？ → 保存策略 → 每日自动扫描匹配
不满意？ → 调参数 → 重新回测
```

## 现有基础

系统已有策略引擎的基础设施：

- **条件系统** (`strategy_engine.py`)：支持字段比较（gt/lt/eq）、交叉判断（cross_above/cross_below）、形态匹配
- **可选字段**：open, high, low, close, volume, ma5, ma20, ma60, ma120, volume_ratio_20, high_20, pattern
- **5 个内置策略** (`strategy_seeds.py`)：均线多头+放量、金叉买入、放量突破前高、底部反转、均线粘合突破
- **扫描机制**：`scan()` 遍历全部 5207 只股票，逐个评估条件，命中结果写入 `strategy_runs`
- **回测脚本** (`backtest.py`)：已有形态回测逻辑，可复用

## 实现计划（最小可行版）

### Step 1: 自然语言解析 API

`POST /api/strategies/parse`

- 输入：`"缩量横盘后放量突破"`
- 输出：解析后的 conditions JSON + 解释文字
- 实现：DeepSeek API，prompt 中列出可用字段和运算符

### Step 2: 即时回测 API

`POST /api/strategies/backtest`

- 输入：conditions JSON + forward_days
- 输出：win_rate, avg_return, max_return, distribution, random_baseline, regime_splits
- 实现：复用 `backtest.py` 逻辑，改为按需即时执行

### Step 3: 因子创建页面

路由：`/strategies/new`

- 双输入通道：自然语言框 + 向导式条件编辑器
- 条件预览区（实时显示 JSON）
- 回测按钮 → 结果展示区（胜率大数字 + 分布图 + 对比）

### Step 4: 策略列表升级

在现有 `/strategies` 页面：
- 区分内置策略和用户策略
- 显示最新回测数据摘要
- 支持运行扫描、编辑、回测、删除

## 前提

1. 自然语言解析作为"快捷输入"，结果可编辑（向导式表单兜底）
2. 因子回测复用 `backtest.py` 逻辑，从命令行改为 API 即时调用
3. 因子存储沿用 `strategies` 表 `conditions` JSON 字段，共用扫描引擎
