import os
import time
from flask import Flask, jsonify, render_template, request
from serial_controller import SerialController, SerialError
from api_client import ApiClient


SERVER_BASE_URL = os.environ.get("SERVER_BASE_URL", "http://localhost:5000")
SERIAL_PORT = os.environ.get("SERIAL_PORT", "/dev/ttyACM0")
SERIAL_BAUD = int(os.environ.get("SERIAL_BAUD", "115200"))


app = Flask(__name__)
serial_ctrl = SerialController(SERIAL_PORT, SERIAL_BAUD)
api_client = ApiClient(SERVER_BASE_URL)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/ping", methods=["GET"])
def ping():
    return jsonify({"status": "ok"})


@app.route("/api/lockers/status", methods=["GET"])
def get_lockers_status():
    """Get status of all lockers (1-15)"""
    # Get status from server
    server_resp, status_code = api_client.get_locker_statuses()
    
    if status_code != 200:
        # Return empty status if server unavailable
        return jsonify({"lockers": {str(i): {"occupied": False, "available": True} for i in range(1, 16)}}), 200
    
    return jsonify(server_resp), status_code


def _validate_locker(locker_id: int):
    if locker_id == 16:
        return False, ("Locker 16 is reserved", 400)
    if locker_id < 1 or locker_id > 16:
        return False, ("Invalid lockerId", 400)
    return True, None


@app.route("/api/deposit/open", methods=["POST"])
def deposit_open():
    data = request.get_json(force=True)
    locker_id = int(data.get("lockerId", 0))
    tracking_code = data.get("trackingCode")
    ok, error = _validate_locker(locker_id)
    if not ok:
        msg, code = error
        return jsonify({"message": msg}), code
    if not tracking_code:
        return jsonify({"message": "trackingCode required"}), 400

    server_resp, status_code = api_client.open_deposit(locker_id, tracking_code)
    if status_code != 200:
        return jsonify(server_resp), status_code

    try:
        serial_ctrl.open_locker(locker_id)
    except SerialError as exc:
        return jsonify({"message": f"Serial error: {exc}"}), 500

    return jsonify(server_resp)


@app.route("/api/deposit/close", methods=["POST"])
def deposit_close():
    data = request.get_json(force=True)
    locker_id = int(data.get("lockerId", 0))
    closet_id = int(data.get("closetId", 0))
    tracking_code = data.get("trackingCode")
    ok, error = _validate_locker(locker_id)
    if not ok:
        msg, code = error
        return jsonify({"message": msg}), code
    if not (closet_id and tracking_code):
        return jsonify({"message": "closetId and trackingCode required"}), 400

    if not serial_ctrl.verify_closed(locker_id):
        return jsonify({"message": "Locker sensor reports open"}), 409

    server_resp, status_code = api_client.close_deposit(locker_id, closet_id, tracking_code)
    return jsonify(server_resp), status_code


@app.route("/api/withdraw/open", methods=["POST"])
def withdraw_open():
    data = request.get_json(force=True)
    locker_id = int(data.get("lockerId", 0))
    password = data.get("password")
    ok, error = _validate_locker(locker_id)
    if not ok:
        msg, code = error
        return jsonify({"message": msg}), code
    if not password:
        return jsonify({"message": "password required"}), 400

    server_resp, status_code = api_client.open_withdraw(locker_id, password)
    if status_code != 200:
        return jsonify(server_resp), status_code

    try:
        serial_ctrl.open_locker(locker_id)
    except SerialError as exc:
        return jsonify({"message": f"Serial error: {exc}"}), 500

    return jsonify(server_resp)


@app.route("/api/withdraw/close", methods=["POST"])
def withdraw_close():
    data = request.get_json(force=True)
    locker_id = int(data.get("lockerId", 0))
    closet_id = int(data.get("closetId", 0))
    ok, error = _validate_locker(locker_id)
    if not ok:
        msg, code = error
        return jsonify({"message": msg}), code
    if not closet_id:
        return jsonify({"message": "closetId required"}), 400

    if not serial_ctrl.verify_closed(locker_id):
        return jsonify({"message": "Locker sensor reports open"}), 409

    server_resp, status_code = api_client.close_withdraw(locker_id, closet_id)
    return jsonify(server_resp), status_code


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)

