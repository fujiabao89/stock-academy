# 故障排查

## 启动问题

### docker compose up 失败

**症状：** `Error: Cannot connect to the Docker daemon`

**修复：** 确认 Docker Desktop 正在运行

```bash
docker ps
```

### PostgreSQL 连接被拒绝

**症状：** `connection refused: db:5432`

**修复：** 等待 PostgreSQL 完全启动后再重启 backend

```bash
docker compose logs db
# 看到 "database system is ready to accept connections" 后：
docker compose restart backend
```

### 端口冲突

**症状：** `port is already allocated`

**修复：**
- 前端默认 5173，后端 8001，PostgreSQL 5433，Redis 6380
- 检查占用：`lsof -i :5433 -i :6380 -i :8001 -i :5173`
- 或在 `.env` 中修改端口映射

---

## 数据问题

### 行情数据为空

**症状：** K 线图无数据，API 返回空数组

**修复：**
```bash
# 检查数据库记录数
docker compose exec db psql -U postgres -d stock_academy \
  -c "SELECT COUNT(*) FROM daily_bars;"

# 如果没有数据，导入种子数据（Baostock 免费无限流）
docker compose exec backend python scripts/seed_hs300.py

# 如果想限速导入：
docker compose exec backend python scripts/seed_hs300.py --max-stocks 100

# 断点续传：
docker compose exec backend python scripts/seed_hs300.py --resume
```

### 股票数据不更新

**症状：** 数据停留在几天前

**原因：**
- A 股周末和节假日不交易，非交易日无新数据
- 每日自动更新在 17:00（收盘后），调度器可能因重启错过

**修复：**
```bash
# 手动跑一次增量更新
docker compose exec backend python scripts/seed_hs300.py

# 查看 K 线更新日志
docker compose logs backend | grep "K线"

# 确认最新数据日期
docker compose exec db psql -U postgres -d stock_academy \
  -c "SELECT MAX(date) FROM daily_bars;"
```

### 部分股票没有最新数据

**原因：** 历史数据导入脚本的 `--resume` 模式和每日调度器都可能在大量股票时中断

**修复：**
```bash
# 断点续传会跳过已有完整历史+最新数据的股票，只处理遗漏的
docker compose exec backend python scripts/seed_hs300.py --resume
```

### 数据源切换

**默认为 Baostock（免费无限流）。** 如需切回 Tushare：

```bash
# 方法 1：命令行参数
docker compose exec backend python scripts/seed_hs300.py --source tushare

# 方法 2：环境变量（永久）
# 在 .env 中设置: STOCK_DATA_SOURCE=tushare
```

---

## 形态信号问题

### 形态信号不更新

**症状：** 搜索股票后信号数据不新鲜

**修复：**
```bash
# 手动触发形态匹配（基于已有日线重新计算）
docker compose exec backend python scripts/run_pattern_match.py
```

---

## 调试

### 查看后端日志

```bash
# 所有服务
docker compose logs -f

# 仅后端
docker compose logs -f backend

# 查看数据库日志
docker compose logs db
```

### 测试 API 是否正常

```bash
# 健康检查
curl http://localhost:8001/api/health

# 形态信号最新数据
curl http://localhost:8001/api/signals/latest

# 策略列表
curl http://localhost:8001/api/strategies

# API 文档
open http://localhost:8001/docs
```

### 测试数据库连接

```bash
docker compose exec db psql -U postgres -d stock_academy \
  -c "SELECT code, MAX(date) FROM daily_bars GROUP BY code LIMIT 5;"
```
