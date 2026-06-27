# Changelog

## [Unreleased]

### Added
- **Baostock 数据源**（默认）：免费、无需注册、无限流，全市场 5207 只 A 股
- 数据源工厂模式（`stock_client.py`），Baostock/Tushare 一键切换
- 每日 K 线自动更新调度器（APScheduler，交易日 17:00）
- 修复 `seed_hs300.py` 跳过逻辑：同时检查最早和最晚数据日期
- 策略引擎：条件组合评估 + 全市场扫描（`strategy_engine.py`）
- 5 个内置策略：均线多头+放量、金叉买入、放量突破前高、底部反转、均线粘合突破
- 用户系统：JWT 注册/登录、自选股管理
- 新闻聚合：新浪财经抓取（30 分钟间隔）+ AI 摘要 + 情感分析（DeepSeek）
- 6 个新形态检测器：锤子线、倒锤子、看涨吞没、看跌吞没、十字星、射击之星
- 形态详情页（PatternDetailPage）+ 示例 K 线图
- 策略页面（StrategiesPage）
- 新闻页面（NewsPage）
- 策略因子实验室设计文档

### Changed
- 数据源从 Tushare 迁移到 Baostock（Tushare 保留为备用）
- K 线图 limit 从 500 扩大到 2500，支持完整 10 年数据
- K 线图移除形态信号标记（366 个标记过于密集）
- 搜索 API 修复：启动时加载股票名称缓存

### Fixed
- `_load()` 重命名为 `load_stock_names()` 修复跨模块 ImportError
- K 线图内容溢出容器边框
- 前端编译错误（crosshairData volume 可选类型 + PatternDetailPage code prop）
