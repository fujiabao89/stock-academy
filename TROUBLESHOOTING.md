# 故障排查

常见启动和运行问题及修复方法。

## 启动问题

### docker compose up 失败

**症状：** `Error: Cannot connect to the Docker daemon`

**修复：**
```bash
# macOS / Windows: 确认 Docker Desktop 正在运行
docker ps

# Linux:
sudo systemctl start docker
```

### PostgreSQL 连接被拒绝

**症状：** `connection refused: db:5432`

**修复：**
```bash
# 等待 PostgreSQL 完全启动
docker compose logs db

# 看到 "database system is ready to accept connections" 后再试
# 如果持续失败，重置数据库：
make reset-db
```

### 端口冲突

**症状：** `port is already allocated`

**修复：**
```bash
# 检查占用端口的进程
lsof -i :80 -i :5432 -i :6379 -i :8000 -i :5173

# 或在 .env 中修改端口映射
```

## 数据问题

### 行情数据为空

**症状：** K 线图无数据，API 返回空数组

**修复：**
```bash
# 检查数据库是否有数据
docker compose exec db psql -U postgres -d stock_academy -c "SELECT COUNT(*) FROM daily_bars;"

# 如果没有数据，填充种子数据
make seed

# 如果种子脚本提示无数据源，设置 TUSHARE_TOKEN：
export TUSHARE_TOKEN=your_token
make seed
```

### 形态信号不更新

**症状：** 搜索股票后提示"信号分析暂不可用"

**原因：** 形态匹配引擎为每日盘后批处理，需要收盘后运行
**修复：** 手动触发匹配
```bash
docker compose exec backend python scripts/run_pattern_match.py
```

## 调试

### 查看后端日志

```bash
# 所有服务日志
docker compose logs -f

# 仅后端日志
docker compose logs -f backend

# 按 correlation_id 追踪请求
docker compose logs backend | grep "correlation_id=abc123"
```

### 测试单个形态检测器

```bash
docker compose exec backend python -c "
from app.engine.detectors.golden_cross import GoldenCross
detector = GoldenCross()
print(detector.pattern_id, detector.describe())
"
```
