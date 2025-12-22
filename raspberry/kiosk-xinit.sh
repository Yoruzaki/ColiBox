#!/usr/bin/env bash
# Minimal X session that launches Chromium directly in kiosk mode

set -euo pipefail

KIOSK_URL="${KIOSK_URL:-http://localhost:8000}"

export DISPLAY=:0
export XAUTHORITY=/home/pi/.Xauthority

# Hide mouse cursor
unclutter -idle 0 &

# Start on-screen keyboard (hidden by default, shows when input is focused)
matchbox-keyboard -s 50 &

exec /usr/bin/chromium \
  --noerrdialogs \
  --kiosk "${KIOSK_URL}" \
  --incognito \
  --disable-translate \
  --disable-features=Translate \
  --disable-features=TranslateUI \
  --disable-infobars \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  --start-fullscreen \
  --touch-events=enabled \
  --disable-pinch
