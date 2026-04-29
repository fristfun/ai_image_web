#!/usr/bin/env bash
set -euo pipefail

# 用法:
#   ./rollback.sh <commit_or_tag>
# 示例:
#   ./rollback.sh 3f2a1b9
#   ./rollback.sh v2026.04.29-1

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "用法: ./rollback.sh <commit_or_tag>"
  exit 1
fi

SERVER="root@你的服务器IP"
APP_ROOT="/www/wwwroot/ai-image"
WEB_DIR="/www/wwwroot/ai-image/web"
API_DIR="/www/wwwroot/ai-image/api"
VENV="/www/server/pyporject_evn/ai-image-api_venv"

echo "==> 开始回滚到: $TARGET"

ssh "$SERVER" <<EOF
set -euo pipefail

TARGET="$TARGET"
APP_ROOT="$APP_ROOT"
WEB_DIR="$WEB_DIR"
API_DIR="$API_DIR"
VENV="$VENV"

cd "\$APP_ROOT"

echo "[server] 记录当前版本"
PREV_COMMIT=\$(git rev-parse --short HEAD)
echo "[server] 当前: \$PREV_COMMIT"

echo "[server] 拉取最新 refs/tags"
git fetch --all --tags

echo "[server] 校验目标版本"
git rev-parse --verify "\$TARGET^{commit}" >/dev/null

echo "[server] checkout 到目标版本"
git checkout -f "\$TARGET"

echo "[server] 回滚前端"
cd "\$WEB_DIR"
npm install
pm2 restart ai-web
pm2 save

echo "[server] 回滚后端"
cd "\$API_DIR"
source "\$VENV/bin/activate"
pip install -r requirements.txt

pkill -f "uvicorn app.main:app --host 127.0.0.1 --port 8000" || true
nohup "\$VENV/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000 --workers 2 >/tmp/ai-api.log 2>&1 &

echo "[server] 重载 Nginx"
if [ -x /www/server/nginx/sbin/nginx ]; then
  /www/server/nginx/sbin/nginx -s reload || true
fi

echo "[server] 健康检查"
sleep 2
curl -fsS http://127.0.0.1:8000/docs >/dev/null
echo "[server] 回滚成功: \$TARGET"
EOF

echo "==> 回滚完成"
echo "前端日志: pm2 logs ai-web --lines 100"
echo "后端日志: tail -n 100 /tmp/ai-api.log"