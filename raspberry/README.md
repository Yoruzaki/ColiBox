# Raspberry Pi Kiosk (Python + Flask)

Kiosk UI for the Smart Locker. Runs locally on Raspberry Pi OS Lite, drives the touchscreen UI, talks to the server for approvals, and controls the Arduino over USB serial.

## Repo workflow (GitHub-ready)
Initial push:
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

## Install Raspberry Pi OS Lite
1) Flash Raspberry Pi OS Lite to SD (Raspberry Pi Imager).  
2) Enable SSH + set hostname (via Imager advanced options).  
3) Boot Pi, SSH in: `ssh pi@<pi-ip>`.

## System prep
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip git xserver-xorg x11-xserver-utils xinit unclutter
# Chromium (Bookworm): use 'chromium'
sudo apt install -y chromium
```

## Python setup
```bash
mkdir -p ~/smart-locker
cd ~/smart-locker
git clone https://github.com/Yoruzaki/ColiBox.git .   # or copy the repo here
cd raspberry
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## USB serial access
```bash
sudo usermod -a -G dialout pi
sudo reboot
```

## Run locally (dev)
```bash
export SERVER_BASE_URL=http://<server-ip>:5000
export SERIAL_PORT=/dev/ttyACM0
python app.py
# open http://<pi-ip>:8000
```

## systemd service (auto-start + auto-restart)
```bash
sudo cp systemd/smart-locker.service /etc/systemd/system/smart-locker.service
sudo systemctl daemon-reload
sudo systemctl enable smart-locker
sudo systemctl start smart-locker
```
Service runs `/usr/bin/python3 /home/pi/smart-locker/ColiBox/raspberry/app.py` and restarts on crash.

## Chromium kiosk on boot (optional)
Create `~/.config/autostart/kiosk.desktop`:
```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/kiosk.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=Locker Kiosk
Exec=/usr/bin/chromium-browser --noerrdialogs --kiosk http://localhost:8000 --incognito --disable-translate --overscroll-history-navigation=0
X-GNOME-Autostart-enabled=true
EOF
```
If your system provides `/usr/bin/chromium` (not `chromium-browser`), adjust the Exec line accordingly.
Hide mouse cursor:
```bash
unclutter -idle 0 &
```

## Updating from GitHub
```bash
cd /home/pi/smart-locker
git pull origin main
sudo systemctl restart smart-locker
```

## Files
- `app.py` Flask UI + endpoints
- `serial_controller.py` Arduino serial bridge (115200 baud)
- `api_client.py` HTTP client to server
- `templates/`, `static/` UI assets
- `systemd/smart-locker.service` systemd unit

## Notes
- Locker 16 is reserved and never opened.
- Serial protocol used: `PING`, `STATUS`, `OPEN:<lockerId>`, `READ:<lockerId>`.
- The app verifies sensor state with `READ:<lockerId>` before confirming close.

