import random
import string
from flask import Blueprint, current_app, jsonify, render_template, request, redirect, url_for
from database import get_db, close_db


bp = Blueprint("routes", __name__)


@bp.teardown_app_request
def teardown(exception):
    close_db()


def _get_db():
    return get_db(current_app)


def _locker_allowed(locker_id: int) -> bool:
    return 1 <= locker_id <= 15


def _generate_closet_id():
    return random.randint(1000, 9999)


def _generate_password():
    return "".join(random.choices(string.digits, k=6))


@bp.route("/")
def index():
    db = _get_db()
    lockers = db.execute("SELECT number, status FROM lockers ORDER BY number").fetchall()
    orders = db.execute(
        "SELECT id, locker_id, closet_id, tracking_code, password, order_type, status, created_at FROM orders ORDER BY created_at DESC LIMIT 20"
    ).fetchall()
    return render_template("index.html", lockers=lockers, orders=orders)


@bp.route("/lockers/<int:locker_id>/reset", methods=["POST"])
def reset_locker(locker_id):
    if not _locker_allowed(locker_id):
        return redirect(url_for("routes.index"))
    db = _get_db()
    db.execute("UPDATE lockers SET status='closed' WHERE number=?", (locker_id,))
    db.execute("UPDATE orders SET status='closed' WHERE locker_id=?", (locker_id,))
    db.commit()
    return redirect(url_for("routes.index"))


@bp.route("/api/lockers/occupied", methods=["GET"])
def get_occupied_lockers():
    """Return list of locker IDs that currently have orders"""
    db = _get_db()
    lockers = db.execute(
        "SELECT DISTINCT locker_id FROM orders WHERE status IN ('awaiting_close', 'closed')"
    ).fetchall()
    occupied = [row["locker_id"] for row in lockers]
    return jsonify({"occupied": occupied})


@bp.route("/api/deposit/open", methods=["POST"])
def open_deposit():
    payload = request.get_json(force=True)
    locker_id = int(payload.get("lockerId", 0))
    tracking_code = payload.get("trackingCode")

    if not _locker_allowed(locker_id):
        return jsonify({"message": "Locker not available"}), 400
    if not tracking_code:
        return jsonify({"message": "trackingCode required"}), 400

    db = _get_db()
    locker = db.execute("SELECT status FROM lockers WHERE number=?", (locker_id,)).fetchone()
    if not locker or locker["status"] != "closed":
        return jsonify({"message": "Locker busy"}), 409

    closet_id = _generate_closet_id()
    db.execute("UPDATE lockers SET status='deposit_open' WHERE number=?", (locker_id,))
    db.execute(
        "INSERT INTO orders (locker_id, closet_id, tracking_code, order_type, status) VALUES (?, ?, ?, 'deposit', 'awaiting_close')",
        (locker_id, closet_id, tracking_code),
    )
    db.commit()
    return jsonify({"closetId": closet_id, "lockerId": locker_id, "message": "Deposit approved, open locker"})


@bp.route("/api/deposit/close", methods=["POST"])
def close_deposit():
    payload = request.get_json(force=True)
    locker_id = int(payload.get("lockerId", 0))
    closet_id = int(payload.get("closetId", 0))
    tracking_code = payload.get("trackingCode")

    if not (_locker_allowed(locker_id) and closet_id and tracking_code):
        return jsonify({"message": "Invalid payload"}), 400

    db = _get_db()
    order = db.execute(
        "SELECT id, status FROM orders WHERE locker_id=? AND closet_id=? AND tracking_code=? AND order_type='deposit'",
        (locker_id, closet_id, tracking_code),
    ).fetchone()
    if not order:
        return jsonify({"message": "Order not found"}), 404
    if order["status"] != "awaiting_close":
        return jsonify({"message": "Invalid order state"}), 409

    password = _generate_password()
    db.execute("UPDATE lockers SET status='closed' WHERE number=?", (locker_id,))
    db.execute(
        "UPDATE orders SET status='closed', password=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (password, order["id"]),
    )
    db.commit()
    return jsonify(
        {
            "closetId": closet_id,
            "lockerId": locker_id,
            "password": password,
            "orderId": order["id"],
            "message": "Deposit closed, password generated",
        }
    )


@bp.route("/api/withdraw/open", methods=["POST"])
def open_withdraw():
    payload = request.get_json(force=True)
    locker_id = int(payload.get("lockerId", 0))
    password = payload.get("password")

    if not (_locker_allowed(locker_id) and password):
        return jsonify({"message": "Invalid payload"}), 400

    db = _get_db()
    locker = db.execute("SELECT status FROM lockers WHERE number=?", (locker_id,)).fetchone()
    if not locker or locker["status"] != "closed":
        return jsonify({"message": "Locker busy"}), 409

    order = db.execute(
        "SELECT id, closet_id, status FROM orders WHERE locker_id=? AND password=? AND order_type='deposit' ORDER BY created_at DESC",
        (locker_id, password),
    ).fetchone()
    if not order or order["status"] != "closed":
        return jsonify({"message": "No deposit found for this password"}), 404

    db.execute("UPDATE lockers SET status='withdraw_open' WHERE number=?", (locker_id,))
    db.execute(
        "UPDATE orders SET status='withdraw_in_progress', updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (order["id"],),
    )
    db.commit()
    return jsonify(
        {
            "closetId": order["closet_id"],
            "lockerId": locker_id,
            "orderId": order["id"],
            "message": "Withdraw approved, open locker",
        }
    )


@bp.route("/api/withdraw/close", methods=["POST"])
def close_withdraw():
    payload = request.get_json(force=True)
    locker_id = int(payload.get("lockerId", 0))
    closet_id = int(payload.get("closetId", 0))

    if not (_locker_allowed(locker_id) and closet_id):
        return jsonify({"message": "Invalid payload"}), 400

    db = _get_db()
    order = db.execute(
        "SELECT id, status FROM orders WHERE locker_id=? AND closet_id=? AND order_type='deposit' ORDER BY created_at DESC",
        (locker_id, closet_id),
    ).fetchone()
    if not order:
        return jsonify({"message": "Order not found"}), 404
    if order["status"] != "withdraw_in_progress":
        return jsonify({"message": "Invalid order state"}), 409

    db.execute("UPDATE lockers SET status='closed' WHERE number=?", (locker_id,))
    db.execute(
        "UPDATE orders SET status='withdrawn', updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (order["id"],),
    )
    db.commit()
    return jsonify({"closetId": closet_id, "lockerId": locker_id, "message": "Withdraw complete"})

