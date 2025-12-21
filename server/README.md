# Smart Locker Server (Admin + API)

Minimal Flask backend for managing lockers and validating Raspberry Pi actions.

## Features
- REST endpoints matching the kiosk contract.
- Simple admin dashboard to view lockers and recent orders.
- SQLite storage seeded with 16 lockers (locker 16 reserved).

## Quickstart
```bash
cd server
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Visit http://localhost:5000 for the admin dashboard.

## API
- `POST /api/deposit/open` body `{ lockerId, trackingCode }`
- `POST /api/deposit/close` body `{ lockerId, closetId, trackingCode }`
- `POST /api/withdraw/open` body `{ lockerId, password }`
- `POST /api/withdraw/close` body `{ lockerId, closetId }`

Responses follow the provided contract (closetId, lockerId, password, orderId, message).

## Database location
Defaults to `server/smartlock.db`. Override with `SMART_LOCK_DB=/path/to/db`.

