#!/usr/bin/env bash
#
# Installs Monster Alert AT as a systemd service on Ubuntu Server LTS
# (tested target: 22.04 / 24.04). Run this from the project root, as root:
#
#   sudo bash deploy/install-ubuntu.sh
#
set -euo pipefail

APP_DIR="/opt/monster-alert"
SERVICE_USER="monsteralert"
NODE_MAJOR="22"

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root: sudo bash deploy/install-ubuntu.sh" >&2
  exit 1
fi

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Installing base packages"
apt-get update -y
apt-get install -y --no-install-recommends ca-certificates curl gnupg rsync

echo "==> Installing Node.js ${NODE_MAJOR}.x (needed: >=22.5 for built-in SQLite)"
if ! command -v node >/dev/null 2>&1 || \
   [ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -lt "$NODE_MAJOR" ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
else
  echo "    Node.js $(node -v) already installed, skipping"
fi

echo "==> Creating system user '${SERVICE_USER}'"
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

echo "==> Copying app to ${APP_DIR}"
mkdir -p "$APP_DIR"
rsync -a --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'prices.db*' \
  "$SOURCE_DIR"/ "$APP_DIR"/

if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo "    Created ${APP_DIR}/.env from .env.example — EDIT THIS before starting the service!"
fi

echo "==> Installing dependencies + Playwright's Chromium (with system libs)"
cd "$APP_DIR"
npm ci --omit=dev
npx playwright install --with-deps chromium

echo "==> Fixing ownership"
chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR"

echo "==> Installing systemd unit"
cp "$APP_DIR/deploy/monster-alert.service" /etc/systemd/system/monster-alert.service
systemctl daemon-reload
systemctl enable monster-alert

cat <<EOF

Done. Next steps:
  1. Edit ${APP_DIR}/.env (NTFY_TOPIC at minimum), then:
  2. sudo systemctl start monster-alert
  3. sudo journalctl -u monster-alert -f      # follow logs
  4. sudo systemctl status monster-alert

To re-deploy after pulling new code, just re-run this script.
EOF
