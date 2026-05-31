# 回测操作指南

## 回测方法论

所有形态的历史回测遵循统一标准（详见设计文档"回测方法论"章节）：

- **回测区间：** 过去 5-10 年
- **前向窗口：** 5/10/20 个交易日
- **胜率定义：** 前向窗口内最高价触及 ≥3% 涨幅计为"有获利机会"
- **市场拆分：** 按沪深300 60日均线方向划分牛/熊/震荡
- **样本门槛：** 总样本 ≥50 次，子环境 ≥30 次才展示
- **排除规则：** 涨跌停日不计入回测样本

## 运行回测

```bash
# 对单个形态运行回测
docker compose exec backend python scripts/backtest.py --pattern golden-cross

# 对所有 8 种形态运行回测
docker compose exec backend python scripts/backtest.py --all

# 指定回测区间
docker compose exec backend python scripts/backtest.py --pattern golden-cross --start 2015-01-01 --end 2025-12-31
```

## 结果解读

回测脚本输出每个形态的：
- precision / recall（基于人工标注验证集）
- 各前向窗口 win_rate / avg_return
- 牛/熊/震荡市中的胜率对比
- 样本总数和各子集分布

## 人工标注

回测脚本调用前需要先构建标注验证集：
```bash
# 生成标注任务
docker compose exec backend python scripts/generate_labels.py --pattern golden-cross --samples 100

# 标注格式（CSV）
# code,date,is_valid,comment
# 000001,2024-01-15,1,MA5确实上穿MA20
# 000002,2024-02-20,0,假金叉，第二天即回落
```
