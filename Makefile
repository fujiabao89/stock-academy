.PHONY: setup dev test lint clean migrate rollback reset-db new-pattern seed

# ============================================================
# 炒股学堂 — 开发命令
# ============================================================

# 首次设置：检查依赖 + 生成 .env + 构建镜像
setup:
	@echo "=== 炒股学堂 项目设置 ==="
	@command -v docker >/dev/null 2>&1 || { echo "请先安装 Docker: https://docs.docker.com/get-docker/"; exit 1; }
	@if [ ! -f .env ]; then cp .env.example .env && echo ".env 已生成"; fi
	@docker compose build
	@echo "设置完成！运行 make dev 启动开发环境"

# 启动开发环境
dev:
	docker compose up --build

# 后端开发（仅后端 + 数据库）
dev-backend:
	docker compose up db redis backend

# 运行测试
test:
	docker compose exec backend pytest tests/ -v

# 代码检查
lint:
	docker compose exec backend ruff check app/
	docker compose exec frontend npx tsc --noEmit

# 清理容器和卷
clean:
	docker compose down -v
	rm -rf backend/__pycache__ backend/app/__pycache__

# ============================================================
# 数据库迁移
# ============================================================

migrate:
	@if [ -z "$(msg)" ]; then echo "用法: make migrate msg='描述'"; exit 1; fi
	cd backend && alembic revision --autogenerate -m "$(msg)"
	cd backend && alembic upgrade head

rollback:
	cd backend && alembic downgrade -1

reset-db:
	docker compose down db
	docker compose up -d db
	@sleep 3
	cd backend && alembic upgrade head
	@echo "数据库已重建，运行 make seed 填充种子数据"

# ============================================================
# 种子数据
# ============================================================

seed:
	docker compose exec backend python scripts/seed_hs300.py

# ============================================================
# 脚手架
# ============================================================

new-pattern:
	@if [ -z "$(id)" ]; then echo "用法: make new-pattern id=my-pattern"; exit 1; fi
	@mkdir -p backend/app/engine/detectors
	@echo "from ..base import PatternDetector" > backend/app/engine/detectors/$(id).py
	@echo "" >> backend/app/engine/detectors/$(id).py
	@echo "class $(shell echo $(id) | sed -r 's/(^|-)(\w)/\U\2/g')(PatternDetector):" >> backend/app/engine/detectors/$(id).py
	@echo "    pattern_id = '$(id)'" >> backend/app/engine/detectors/$(id).py
	@echo "    pattern_name = ''" >> backend/app/engine/detectors/$(id).py
	@echo "    category = ''" >> backend/app/engine/detectors/$(id).py
	@echo "    direction = ''" >> backend/app/engine/detectors/$(id).py
	@echo "" >> backend/app/engine/detectors/$(id).py
	@echo "    def match(self, bars): ..." >> backend/app/engine/detectors/$(id).py
	@mkdir -p backend/tests/engine
	@echo "def test_$(id)():" > backend/tests/engine/test_$(id).py
	@echo "    pass" >> backend/tests/engine/test_$(id).py
	@echo "已生成: backend/app/engine/detectors/$(id).py"
	@echo "已生成: backend/tests/engine/test_$(id).py"
