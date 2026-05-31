# 形态检测器开发指南

## 概述

每个形态检测器继承 `PatternDetector` 基类，实现 `match()` 判定方法，通过 registry 注册。

## 快速开始

```bash
# 1. 生成骨架
make new-pattern id=volume-breakout

# 2. 编辑检测器
# backend/app/engine/detectors/volume_breakout.py

# 3. 编写测试
# backend/tests/engine/test_volume_breakout.py

# 4. 运行回测验证
docker compose exec backend python scripts/backtest.py --pattern volume-breakout
```

## PatternDetector 接口

```python
class PatternDetector(ABC):
    pattern_id: str       # 唯一标识，kebab-case，如 "golden-cross"
    pattern_name: str     # 中文名，如 "金叉"
    category: str         # 分类：均线/K线/量价/基本面/盘面
    direction: str        # "bullish" / "bearish" / "neutral"

    def match(self, bars: Sequence[DailyBar]) -> bool:
        """给定日线序列（bars[-1] 为当日），判断是否触发"""

    def limitations(self) -> list[str]:
        """返回局限性提醒列表"""
```

## 判定规则要求

- **规则可明确表达** — MVP 阶段不能用 ML/DL 方式
- **判定阈值固定** — 如 `量比 > 1.5`、`MA5 > MA20`
- **忽略涨跌停日** — 回测阶段自动过滤

## 回测标准

- 回测区间：过去 5-10 年（覆盖至少一轮牛熊）
- 前向窗口：5/10/20 个交易日
- 胜率定义：前向窗口内最高价触及 ≥3% 涨幅
- 需 ≥50 个样本才展示回测数据

## 测试要求

- 单元测试：≥5 个正样本 + ≥5 个负样本
- 边界情况：None MA 值、日线不足、新股前几日
- Precision > 85% at Recall > 80%（人工标注 ≥100 样本）
