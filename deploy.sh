#!/usr/bin/env bash
set -euo pipefail

SERVER="root@47.79.243.122"
BRANCH="main"
REMOTE="origin"

APP_ROOT="/www/wwwroot/ai-image"
WEB_DIR="/www/wwwroot/ai-image/web"
API_DIR="/www/wwwroot/ai-image/api"
VENV="/www/server/pyporject_evn/ai-image-api_venv"

echo "==> [1/5] Local checks"
git rev-parse --is-inside-work-tree >/dev/null
git diff --quiet || { echo "工作区有未提交修改，请先 commit"; exit 1; }

echo "==> [2/5] Push to remote"
git push "$REMOTE" "$BRANCH"

echo "==> [3/5] Deploy on server"
ssh "$SERVER" <<EOF
set -euo pipefail

APP_ROOT="$APP_ROOT"
WEB_DIR="$WEB_DIR"
API_DIR="$API_DIR"
VENV="$VENV"
BRANCH="$BRANCH"

cd "\$APP_ROOT"
git fetch origin
git checkout "\$BRANCH"
git pull --ff-only origin "\$BRANCH"

echo "[server] Frontend deploy"
cd "\$WEB_DIR"
npm install
pm2 restart ai-web
pm2 save

echo "[server] Backend deploy"
cd "\$API_DIR"
source "\$VENV/bin/activate"
pip install -r requirements.txt

# 平滑重启后端（沿用你的当前参数）
pkill -f "uvicorn app.main:app --host 127.0.0.1 --port 8000" || true
nohup "\$VENV/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000 --workers 2 >/tmp/ai-api.log 2>&1 &

echo "[server] Nginx reload"
if [ -x /www/server/nginx/sbin/nginx ]; then
  /www/server/nginx/sbin/nginx -s reload || true
fi

echo "[server] Health check"
sleep 2
curl -fsS http://127.0.0.1:8000/docs >/dev/null && echo "API OK" || (echo "API health failed"; exit 1)

echo "[server] Deploy done"
EOF

echo "==> [4/5] Done"
echo "前端日志: pm2 logs ai-web --lines 100"
echo "后端日志: tail -n 100 /tmp/ai-api.log"