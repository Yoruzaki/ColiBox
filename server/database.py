import sqlite3
from flask import g


BOX_COUNT = 16  # Nombre de compartiments par machine


def get_db(app):
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE_PATH"])
        g.db.row_factory = sqlite3.Row
    return g.db


def init_db(app):
    with app.app_context():
        db = get_db(app)

        # Créer les tables si absentes
        create_tables(db)

        # Si l'ancienne base (sans machine_id / boxes) existe, on reconstruit proprement
        if not column_exists(db, "lockers", "machine_id") or not table_exists(db, "boxes"):
            rebuild_db(db)
        else:
            seed_data(db)

        db.commit()


def table_exists(db, table_name: str) -> bool:
    row = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    ).fetchone()
    return row is not None


def column_exists(db, table_name: str, column_name: str) -> bool:
    rows = db.execute(f"PRAGMA table_info({table_name})").fetchall()
    return any(r["name"] == column_name for r in rows)


def rebuild_db(db):
    db.execute("DROP TABLE IF EXISTS orders")
    db.execute("DROP TABLE IF EXISTS boxes")
    db.execute("DROP TABLE IF EXISTS lockers")
    create_tables(db)
    seed_data(db)


def create_tables(db):
    # Table des machines (lockers)
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS lockers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id INTEGER UNIQUE NOT NULL,
            name TEXT,
            location TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    # Table des compartiments (boxes)
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS boxes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            locker_id INTEGER NOT NULL,
            box_number INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'available',
            FOREIGN KEY(locker_id) REFERENCES lockers(id),
            UNIQUE(locker_id, box_number)
        )
        """
    )

    # Table des commandes
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            locker_id INTEGER NOT NULL,
            box_id INTEGER NOT NULL,
            closet_id INTEGER NOT NULL,
            tracking_code TEXT,
            password TEXT,
            order_type TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(locker_id) REFERENCES lockers(id),
            FOREIGN KEY(box_id) REFERENCES boxes(id)
        )
        """
    )


def seed_data(db):
    # Créer la machine par défaut (ID=1)
    existing_locker = db.execute("SELECT COUNT(*) as count FROM lockers WHERE machine_id=1").fetchone()["count"]
    if existing_locker == 0:
        db.execute(
            "INSERT INTO lockers (machine_id, name, location, status) VALUES (?, ?, ?, ?)",
            (1, "Locker Principal", "Emplacement 1", "active")
        )
        locker_id = db.execute("SELECT id FROM lockers WHERE machine_id=1").fetchone()["id"]
        
        # Créer les 16 boxes pour cette machine
        db.executemany(
            "INSERT INTO boxes (locker_id, box_number, status) VALUES (?, ?, ?)",
            [(locker_id, i, "available") for i in range(1, BOX_COUNT + 1)]
        )


def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()
