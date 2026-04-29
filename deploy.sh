#!/usr/bin/env bash
set -Eeuo pipefail

########################################
# Config
########################################
SERVER="root@47.79.243.122"
SSH_KEY="$HOME/.ssh/id_ed25519"

BRANCH="main"
REMOTE="origin"

APP_ROOT="/www/wwwroot/ai-image"
WEB_DIR="/www/wwwroot/ai-image/web"
API_DIR="/www/wwwroot/ai-image/api"
VENV="/www/server/pyporject_evn/ai-image-api_venv"

# FastAPI health URL (按需改成你自己的健康检查接口)
HEALTH_URL="http://127.0.0.1:8000/docs"

########################################
# Helpers
########################################
log()  { echo -e "\033[1;34m[INFO]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ OK ]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
err()  { echo -e "\033[1;31m[ERR ]\033[0m $*" >&2; }

on_error() {
  local code=$?
  err "部署失败（exit code: $code）"
  err "请先检查："
  err "1) SSH 连通与密钥: ssh -i \"$SSH_KEY\" $SERVER"
  err "2) 服务器日志: pm2 logs ai-web --lines 100"
  err "3) 后端日志: tail -n 100 /tmp/ai-api.log"
  exit "$code"
}
trap on_error ERR

########################################
# 0) Preconditions
########################################
log "==> [0/6] 检查本地环境"
command -v git >/dev/null || { err "未找到 git"; exit 1; }
command -v ssh >/dev/null || { err "未找到 ssh"; exit 1; }

[ -f "$SSH_KEY" ] || { err "SSH 私钥不存在: $SSH_KEY"; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null || { err "当前目录不是 git 仓库"; exit 1; }

# 要求工作区干净，避免“以为发布了其实没提交”
if ! git diff --quiet || ! git diff --cached --quiet; then
  err "工作区有未提交改动，请先 commit 后再部署。"
  err "可用: git status"
  exit 1
fi
ok "本地检查通过"

########################################
# 1) Push
########################################
log "==> [1/6] 推送代码到 $REMOTE/$BRANCH"
git push "$REMOTE" "$BRANCH"
ok "代码已推送"

########################################
# 2) Deploy on server
########################################
log "==> [2/6] 连接服务器并执行部署"

ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new "$SERVER" "bash -s" <<EOF
set -Eeuo pipefail

log()  { echo -e "\033[1;34m[SVR]\033[0m \$*"; }
ok()   { echo -e "\033[1;32m[SVR]\033[0m \$*"; }
err()  { echo -e "\033[1;31m[SVR]\033[0m \$*" >&2; }

APP_ROOT="$APP_ROOT"
WEB_DIR="$WEB_DIR"
API_DIR="$API_DIR"
VENV="$VENV"
BRANCH="$BRANCH"
HEALTH_URL="$HEALTH_URL"

# 记录失败现场
on_error() {
  local code=\$?
  err "服务器部署步骤失败（exit: \$code）"
  err "建议排查："
  err "  pm2 logs ai-web --lines 100"
  err "  tail -n 150 /tmp/ai-api.log"
  exit "\$code"
}
trap on_error ERR

[ -d "\$APP_ROOT" ] || { err "目录不存在: \$APP_ROOT"; exit 1; }
[ -d "\$WEB_DIR" ]  || { err "目录不存在: \$WEB_DIR"; exit 1; }
[ -d "\$API_DIR" ]  || { err "目录不存在: \$API_DIR"; exit 1; }
[ -x "\$VENV/bin/python3" ] || { err "Python venv 不存在或不可执行: \$VENV"; exit 1; }

log "进入项目目录: \$APP_ROOT"
cd "\$APP_ROOT"

log "强制对齐远程分支 origin/\$BRANCH（覆盖本地漂移）"
git fetch origin "\$BRANCH"
git reset --hard "origin/\$BRANCH"
git clean -fd
ok "代码已对齐"

log "部署前端"
cd "\$WEB_DIR"
npm install
pm2 restart ai-web
pm2 save
ok "前端完成"

log "部署后端"
cd "\$API_DIR"
source "\$VENV/bin/activate"
pip install -r requirements.txt

# 平滑重启 uvicorn（与你当前实际参数一致）
pkill -f "uvicorn app.main:app --host 127.0.0.1 --port 8000" || true
nohup "\$VENV/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000 --workers 2 >/tmp/ai-api.log 2>&1 &
sleep 2
ok "后端已重启"

log "重载 Nginx（宝塔路径）"
if [ -x /www/server/nginx/sbin/nginx ]; then
  /www/server/nginx/sbin/nginx -s reload || true
  ok "Nginx 已重载"
else
  err "未找到 /www/server/nginx/sbin/nginx（已跳过）"
fi

log "健康检查: \$HEALTH_URL"
curl -fsS "\$HEALTH_URL" >/dev/null
ok "健康检查通过"

ok "服务器部署完成"
EOF

ok "==> [3/6] 部署成功"

########################################
# 3) Post hints
########################################
cat <<'TXT'

下一步可选检查：
- 前端日志: pm2 logs ai-web --lines 100
- 后端日志: tail -n 100 /tmp/ai-api.log
- PM2 状态:  pm2 status

TXT