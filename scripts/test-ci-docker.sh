#!/bin/bash
set -e

echo "🐳 Running CI tests in Docker..."
echo ""

docker compose -f docker-compose.ci.yml up \
  --build \
  --abort-on-container-exit \
  --exit-code-from tests

exit_code=$?

echo ""
if [ $exit_code -eq 0 ]; then
  echo "✅ All tests passed!"
else
  echo "❌ Tests failed"
fi

docker compose -f docker-compose.ci.yml down

exit $exit_code
