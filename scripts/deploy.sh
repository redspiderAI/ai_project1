#!/usr/bin/env bash
# 在 Linux / macOS / Git Bash 下用 scp 部署 dist 到 /var/www/html/project2。
# 只写入该子目录，不碰同级的 project1、project3；若 DEPLOY_PATH 最后一级不是 project2 会直接报错退出。
#
# 默认 DEPLOY_HOST=Red_spider_api2，与 ~/.ssh/config 中 Host 别名一致，例如:
#   Host Red_spider_api2
#       HostName 111.229.25.160
#       IdentityFile ~/.ssh/redspiderkey2.pem
#       User ubuntu
#
# 用法:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh
#   DEPLOY_SSH_KEY=~/.ssh/key.pem DEPLOY_HOST=111.229.25.160 ./scripts/deploy.sh
#
# 环境变量:
#   DEPLOY_HOST       默认 Red_spider_api2（scp 用；无 SSH config 时可改为 IP 并设 DEPLOY_SSH_KEY）
#   DEPLOY_USER       默认 ubuntu
#   DEPLOY_SITE_HOST  默认 111.229.25.160（仅完成提示里的站点 URL）
#   DEPLOY_PATH       默认 /var/www/html/project2
#   DEPLOY_SSH_KEY    若设置且文件存在，则 scp 加 -i
#   SKIP_BUILD=1      仅上传已有 dist
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DEPLOY_HOST="${DEPLOY_HOST:-Red_spider_api2}"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
DEPLOY_SITE_HOST="${DEPLOY_SITE_HOST:-111.229.25.160}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/html/project2}"

_d="${DEPLOY_PATH%/}"
_leaf="${_d##*/}"
if [[ "$_leaf" != "project2" ]]; then
  echo "错误: DEPLOY_PATH 的最后一级必须是 project2，以免误覆盖 project1/project3。当前: $DEPLOY_PATH" >&2
  exit 1
fi

echo "==> 项目目录: $ROOT"
echo "==> 目标（仅 project2 目录）: ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"

if [[ "${SKIP_BUILD:-}" != "1" ]]; then
  echo "==> npm install..."
  npm install
  echo "==> npm run build..."
  npm run build
else
  echo "==> 已跳过构建 (SKIP_BUILD=1)"
fi

if [[ ! -f "$ROOT/dist/index.html" ]]; then
  echo "错误: dist/index.html 不存在" >&2
  exit 1
fi

SCP_OPTS=(-r)
if [[ -n "${DEPLOY_SSH_KEY:-}" && -f "${DEPLOY_SSH_KEY}" ]]; then
  SCP_OPTS+=(-i "$DEPLOY_SSH_KEY")
  echo "==> 使用密钥: $DEPLOY_SSH_KEY"
fi

echo "==> scp 上传 dist -> ${DEPLOY_PATH}..."
scp "${SCP_OPTS[@]}" "$ROOT/dist/." "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

echo "==> 完成。站点: http://${DEPLOY_SITE_HOST}/project2/"
echo "    若需重载 Nginx: sudo nginx -t && sudo systemctl reload nginx"
