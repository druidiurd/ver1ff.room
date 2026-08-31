#!/usr/bin/env bash
# deploy.sh — ver1ff.tools → h1d3.stream
# Run from project root via Git Bash: ./deploy.sh
# Optional: ./deploy.sh --skip-build  (just upload + restart)

set -e

SSH_KEY="$HOME/.ssh/id_deploy_ver1ff"
REMOTE="ver1ff@74.50.87.75"
REMOTE_DIR="/home/ver1ff/ver1ff"
SSH="ssh -i $SSH_KEY"
SCP="scp -i $SSH_KEY"

SKIP_BUILD=false
[[ "$1" == "--skip-build" ]] && SKIP_BUILD=true

# ── 0. Auto-generate changelog ─────────────────────────────────────────────
echo "  [0/4] checking for changelog updates..."
node scripts/generate-changelog.js 2>/dev/null || true

VERSION=$(node -e "console.log(require('./changelog.json').version)" 2>/dev/null || echo "?")

echo ""
echo "  ver1ff deploy  →  h1d3.stream  [v${VERSION}]"
echo "  ─────────────────────────────────────────────"

# ── 1. Build ───────────────────────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  echo "  [1/4] ng build production..."
  ng build --configuration production --base-href / 2>&1 | grep -E 'complete|ERROR|WARNING.*budget' || true
else
  echo "  [1/4] skipping build"
fi

# ── 2. Pack dist/ ──────────────────────────────────────────────────────────
echo "  [2/4] packing dist/..."
DIST_TMP=$(mktemp /tmp/ver1ff_dist_XXXX.tar.gz)
tar -czf "$DIST_TMP" dist/

# ── 3. Pack api/ + changelog ───────────────────────────────────────────────
echo "  [3/4] packing api/ + changelog..."
API_TMP=$(mktemp /tmp/ver1ff_api_XXXX.tar.gz)
tar --exclude="*/__pycache__" --exclude="*.pyc" --exclude=".env" \
    -czf "$API_TMP" api/ changelog.json

# ── 4. Upload & restart ────────────────────────────────────────────────────
echo "  [4/4] uploading → restarting..."

$SCP "$DIST_TMP" "$REMOTE:/home/ver1ff/ver1ff_dist.tar.gz"
$SCP "$API_TMP"  "$REMOTE:/home/ver1ff/ver1ff_api.tar.gz"

$SSH "$REMOTE" "
  set -e
  cd $REMOTE_DIR
  tar xzf /home/ver1ff/ver1ff_dist.tar.gz
  tar xzf /home/ver1ff/ver1ff_api.tar.gz
  rm /home/ver1ff/ver1ff_dist.tar.gz /home/ver1ff/ver1ff_api.tar.gz
  systemctl --user restart ver1ff-api
  sleep 2
  systemctl --user is-active ver1ff-api
"

rm -f "$DIST_TMP" "$API_TMP"

echo ""
echo "  ✓ deployed v${VERSION} → https://h1d3.stream"
echo ""
