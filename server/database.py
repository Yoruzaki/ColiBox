import sqlite3
from flask import g


LOCKER_COUNT = 16


def get_db(app):
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE_PATH"])
        g.db.row_factory = sqlite3.Row
    return g.db


def init_db(app):
    with app.app_context():
        db = get_db(app)
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS lockers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                number INTEGER UNIQUE NOT NULL,
                status TEXT NOT NULL DEFAULT 'closed'
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                locker_id INTEGER NOT NULL,
                closet_id INTEGER NOT NULL,
                tracking_code TEXT,
                password TEXT,
                order_type TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(locker_id) REFERENCES lockers(id)
            )
            """
        )
        seed_lockers(db)
        db.commit()


def seed_lockers(db):
    existing = db.execute("SELECT COUNT(*) as count FROM lockers").fetchone()["count"]
    if existing >= LOCKER_COUNT:
        return
    db.executemany(
        "INSERT OR IGNORE INTO lockers (number, status) VALUES (?, ?)",
        [(i, "closed") for i in range(1, LOCKER_COUNT + 1)],
    )


def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()

