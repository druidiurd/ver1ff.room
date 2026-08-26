#!/usr/bin/env bash
# bootstrap.sh — первый запуск на VPS под юзером ver1ff
# Запускать: ssh ver1ff "bash -s" < infra/bootstrap.sh
# Переменные передать перед запуском или вписать вручную

set -e

TUNNEL_TOKEN="${TUNNEL_TOKEN:-REPLACE_ME}"
APP_DIR="/home/ver1ff/ver1ff"
BIN_DIR="/home/ver1ff/bin"
SYSTEMD_DIR="$HOME/.config/systemd/user"
CF_VERSION="2025.5.0"

echo "==> [1] Директории"
mkdir -p "$APP_DIR" "$BIN_DIR" "$SYSTEMD_DIR"

echo "==> [2] cloudflared бинарник"
if [ ! -f "$BIN_DIR/cloudflared" ]; then
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/download/${CF_VERSION}/cloudflared-linux-amd64" \
    -o "$BIN_DIR/cloudflared"
  chmod +x "$BIN_DIR/cloudflared"
fi
echo "cloudflared $($BIN_DIR/cloudflared version)"

echo "==> [3] Python venv"
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install -q --upgrade pip
"$APP_DIR/venv/bin/pip" install -q \
  fastapi uvicorn[standard] \
  pillow piexif \
  reportlab pypdf \
  python-multipart

echo "==> [4] .env (если нет)"
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" << 'EOF'
# ver1ff environment
# TUNNEL_TOKEN заполни вручную
TUNNEL_TOKEN=REPLACE_ME
EOF
  chmod 600 "$ENV_FILE"
fi

echo "==> [5] systemd user units"
cp "$APP_DIR/infra/ver1ff-api.service" "$SYSTEMD_DIR/"

# tunnel unit с токеном
sed "s/%i/$TUNNEL_TOKEN/" "$APP_DIR/infra/ver1ff-tunnel.service" \
  > "$SYSTEMD_DIR/ver1ff-tunnel.service"

systemctl --user daemon-reload
systemctl --user enable ver1ff-api ver1ff-tunnel
systemctl --user start  ver1ff-api ver1ff-tunnel

echo "==> Done"
echo "API:    http://127.0.0.1:8000"
echo "Tunnel: h1d3.stream → :8000"
systemctl --user status ver1ff-api --no-pager
