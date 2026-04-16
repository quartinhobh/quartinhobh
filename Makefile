.PHONY: help ci test lint typecheck build clean install test-docker test-integration

# Default target
help:
	@echo "📦 Quartinho CI/CD Commands"
	@echo ""
	@echo "  make ci                 - Run full CI pipeline (lint, typecheck, test, build)"
	@echo "  make test               - Run unit tests for api & web"
	@echo "  make lint               - Run linter for api & web"
	@echo "  make typecheck          - Run TypeScript type checking for api & web"
	@echo "  make build              - Build web (production)"
	@echo "  make test-integration   - Run API integration tests against emulators (Docker)"
	@echo "  make test-docker        - Run complete CI in isolated Docker containers"
	@echo "  make install            - Install dependencies"
	@echo "  make clean              - Remove build artifacts and lockfiles"
	@echo ""

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	bun install

# Lint both workspaces
lint:
	@echo "🔍 Linting api..."
	bun run --filter=api lint
	@echo "✅ API lint passed"
	@echo ""
	@echo "🔍 Linting web..."
	bun run --filter=web lint
	@echo "✅ Web lint passed"

# Type checking both workspaces
typecheck:
	@echo "🔎 Type checking api..."
	bun run --filter=api typecheck
	@echo "✅ API typecheck passed"
	@echo ""
	@echo "🔎 Type checking web..."
	bun run --filter=web typecheck
	@echo "✅ Web typecheck passed"

# Unit tests both workspaces
test:
	@echo "🧪 Testing api..."
	bun run --filter=api test
	@echo "✅ API tests passed"
	@echo ""
	@echo "🧪 Testing web..."
	bun run --filter=web test
	@echo "✅ Web tests passed"

# Build web (production)
build:
	@echo "🔨 Building web..."
	bun run --filter=web build
	@echo "✅ Web build successful"

# Run integration tests (requires Firebase emulators in Docker)
test-integration:
	@echo "🐳 Running API integration tests in Docker..."
	./scripts/test-ci-docker.sh

# Run full CI pipeline locally
ci: install lint typecheck test build
	@echo ""
	@echo "✨ All CI checks passed!"

# Run complete CI in isolated Docker containers
test-docker:
	@echo "🐳 Running complete CI in Docker..."
	./scripts/test-ci-docker.sh

# Clean build artifacts
clean:
	@echo "🧹 Cleaning..."
	rm -rf dist/ .next/ coverage/
	docker compose -f docker-compose.ci.yml down 2>/dev/null || true
	@echo "✅ Cleaned"
