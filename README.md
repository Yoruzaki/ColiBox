# Smart Locker System

Two-part reference implementation:
- `server/` Flask backend + admin dashboard (SQLite).
- `raspberry/` Raspberry Pi kiosk UI (Flask + pyserial).

Hardware: Raspberry Pi 4 + Arduino Mega + 16 relays + 16 magnetic sensors + 7" touchscreen. Locker 16 is reserved and never opened.

## Quick start
Server:
```bash
cd server
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py  # http://localhost:5000
```

Raspberry (dev):
```bash
cd raspberry
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export SERVER_BASE_URL=http://<server-ip>:5000
export SERIAL_PORT=/dev/ttyACM0
python app.py  # http://<pi-ip>:8000
```

## API contract (server implements)
- `POST /api/deposit/open` `{ lockerId, trackingCode }`
- `POST /api/deposit/close` `{ lockerId, closetId, trackingCode }`
- `POST /api/withdraw/open` `{ lockerId, password }`
- `POST /api/withdraw/close` `{ lockerId, closetId }`

Responses include `closetId`, `lockerId`, `password` (on deposit close), `orderId`, `message`.

## GitHub-ready (Pi)
See `raspberry/README.md` for git workflow, system setup, kiosk mode, and systemd instructions.

