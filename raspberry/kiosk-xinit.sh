#!/usr/bin/env bash
# Minimal X session that launches Chromium directly in kiosk mode

set -euo pipefail

KIOSK_URL="${KIOSK_URL:-http://localhost:8000}"

export DISPLAY=:0
export XAUTHORITY=/home/pi/.Xauthority

# Map touchscreen to the active display
if command -v xrandr >/dev/null 2>&1 && command -v xinput >/dev/null 2>&1; then
  OUTPUT=$(DISPLAY=:0 xrandr | awk '/ connected/{print $1; exit}')
  if [ -n "${OUTPUT}" ]; then
    DISPLAY=:0 xinput map-to-output "wch.cn USB2IIC_CTP_CONTROL" "${OUTPUT}" || true
  fi
fi

# Hide mouse cursor
unclutter -idle 0 &

exec /usr/bin/chromium \
  --noerrdialogs \
  --kiosk "${KIOSK_URL}" \
  --incognito \
  --disable-translate \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  --start-fullscreen

