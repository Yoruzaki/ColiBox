# Smart Locker System – Installation Guide

This file collects all install + launch steps in one place for both the Server (admin/API) and Raspberry Pi Kiosk.

---
## 1) Prerequisites
- Hardware: Raspberry Pi 4, Arduino Mega, 16 relays/sensors, 7" touchscreen.
- Locker 16 is reserved; only lockers 1–15 are usable.
- Serial link: Raspberry Pi ↔ Arduino Mega over USB at 115200 baud.
- Software: Python 3.10+, git, Chromium (for kiosk).

Repo layout:
- `server/` — Flask backend + SQLite + admin dashboard.
- `raspberry/` — Pi kiosk Flask app + pyserial + kiosk UI.

---
## 2) Server Installation (Flask + SQLite)
1) Clone repo and enter:
```bash
git clone https://github.com/Yoruzaki/ColiBox.git
cd ColiBox/server
```
2) Create venv and install deps:
```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate
pip install -r requirements.txt
```
3) Run:
```bash
python app.py
# Admin dashboard: http://localhost:5000
```
4) Optional: set database path
```bash
set SMART_LOCK_DB=C:\path\to\smartlock.db    # Windows
export SMART_LOCK_DB=/path/to/smartlock.db   # Linux/macOS
```

---
## 3) Raspberry Pi Setup (OS + Packages)
1) Flash Raspberry Pi OS Lite (via Raspberry Pi Imager). Enable SSH + set hostname.
2) Boot Pi, SSH in:
```bash
ssh pi@<pi-ip>
```
3) Update system + install packages:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip git \
  xserver-xorg x11-xserver-utils xinit unclutter
# Chromium (Bookworm and newer): chromium
sudo apt install -y chromium
```
4) Clone repo on Pi:
```bash
mkdir -p ~/smart-locker
cd ~/smart-locker
git clone https://github.com/Yoruzaki/ColiBox.git .
```
5) Python env and deps:
```bash
cd raspberry
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
6) Serial permissions:
```bash
sudo usermod -a -G dialout pi
sudo reboot
```

---
## 4) Raspberry Pi Kiosk Configuration
Environment variables (set before running/service):
- `SERVER_BASE_URL` (e.g., `http://<server-ip>:5000`)
- `SERIAL_PORT` (e.g., `/dev/ttyACM0`)
- `SERIAL_BAUD` (optional, defaults 115200)

Run manually for testing:
```bash
export SERVER_BASE_URL=http://<server-ip>:5000
export SERIAL_PORT=/dev/ttyACM0
python app.py
# Kiosk UI: http://<pi-ip>:8000
```

### systemd service (auto-start + auto-restart)
```bash
sudo cp systemd/smart-locker.service /etc/systemd/system/smart-locker.service
sudo systemctl daemon-reload
sudo systemctl enable smart-locker
sudo systemctl start smart-locker
```
- Service runs `/usr/bin/python3 /home/pi/smart-locker/raspberry/app.py`.
- Restart after updates:
```bash
sudo systemctl restart smart-locker
```

### Chromium kiosk mode (optional GUI autostart)
If using Raspberry Pi OS Lite (no desktop), install X components (already listed) and auto-start Chromium in kiosk after login:

1) Ensure `pi` autologin on tty1 (Pi OS Lite default). If not:
```bash
sudo raspi-config  # System Options -> Boot / Auto Login -> Console Autologin
```

2) Create a kiosk launcher:
```bash
cat > ~/start-kiosk.sh <<'EOF'
#!/usr/bin/env bash
export DISPLAY=:0
export XAUTHORITY=/home/pi/.Xauthority
unclutter -idle 0 &
/usr/bin/chromium-browser \
  --noerrdialogs \
  --kiosk http://localhost:8000 \
  --incognito \
  --disable-translate \
  --overscroll-history-navigation=0
EOF
chmod +x ~/start-kiosk.sh
```

3) Auto-start X + Chromium on login:
```bash
cat >> ~/.bash_profile <<'EOF'
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  startx /usr/bin/env DISPLAY=:0 /usr/bin/openbox-session &
  sleep 3
  /home/pi/start-kiosk.sh
fi
EOF
```

4) Disable screen blanking:
```bash
cat > ~/.xinitrc <<'EOF'
xset s off
xset -dpms
xset s noblank
openbox-session &
EOF
```

If using the full desktop variant, you can instead use LXDE autostart:
```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/kiosk.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=Locker Kiosk
Exec=/usr/bin/chromium --noerrdialogs --kiosk http://localhost:8000 --incognito --disable-translate --overscroll-history-navigation=0
X-GNOME-Autostart-enabled=true
EOF
```
If your distro exposes `/usr/bin/chromium` instead, swap the path in the launcher/Exec lines.

### Pure kiosk mode (no desktop, via systemd + xinit)
For a desktop-less boot straight into Chromium:
```bash
cd /home/pi/smart-locker/ColiBox/raspberry
chmod +x kiosk-xinit.sh
sudo cp systemd/kiosk-browser.service /etc/systemd/system/kiosk-browser.service
# optional: set KIOSK_URL inside the unit to your desired URL (default http://localhost:8000)
sudo nano /etc/systemd/system/kiosk-browser.service

sudo systemctl daemon-reload
sudo systemctl enable kiosk-browser
sudo systemctl start kiosk-browser
sudo systemctl status kiosk-browser
```
This starts X via xinit and launches Chromium in kiosk on tty1 without showing a desktop.

---
## 5) Git Workflow (Pi + Dev)
Initial push example:
```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/Yoruzaki/ColiBox.git
git push -u origin main
```
Pull updates on Pi:
```bash
cd /home/pi/smart-locker
git pull origin main
sudo systemctl restart smart-locker
```
Push updates from dev machine:
```bash
git add .
git commit -m "describe change"
git push origin main
```

---
## 6) API Contract (implemented by server)
- `POST /api/deposit/open` `{ lockerId, trackingCode }`
- `POST /api/deposit/close` `{ lockerId, closetId, trackingCode }`
- `POST /api/withdraw/open` `{ lockerId, password }`
- `POST /api/withdraw/close` `{ lockerId, closetId }`
Responses include `closetId`, `lockerId`, `password` (on deposit close), `orderId`, `message`.

---
## 7) Quick Sanity Test (loopback)
1) Start server locally: `python app.py` in `server/`.
2) Start kiosk locally (on same machine): set `SERVER_BASE_URL=http://localhost:5000`, run `python app.py` in `raspberry/`.
3) Visit kiosk UI (`http://localhost:8000`), perform a deposit with locker 1 + sample tracking code, then close; note password returned.
4) Withdraw with that password; confirm closes successfully.

---
## 8) Notes / Safety
- Locker 16 must not be opened; app enforces this.
- Arduino firmware is fixed and not modified.
- Serial protocol: `PING`, `STATUS`, `OPEN:<lockerId>`, `READ:<lockerId>`.

