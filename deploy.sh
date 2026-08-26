#!/usr/bin/env bash
# deploy.sh — ver1ff.tools → VPS (ver1ff@74.50.87.75)
# Usage: ./deploy.sh
# Requires: ng CLI, rsync, ssh alias 'ver1ff' in ~/.ssh/config

set -e

REMOTE="ver1ff"
REMOTE_DIR="/home/ver1ff/ver1ff"

echo "==> [1/4] Angular production build"
ng build --configuration production --base-href /

echo "==> [2/4] Sync dist/"
rsync -avz --delete dist/ "$REMOTE:$REMOTE_DIR/dist/"

echo "==> [3/4] Sync api/"
rsync -avz --delete \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.env' \
  api/ "$REMOTE:$REMOTE_DIR/api/"

echo "==> [4/4] Restart API service"
ssh "$REMOTE" "systemctl --user restart ver1ff-api"

echo "==> Done. https://h1d3.stream"
