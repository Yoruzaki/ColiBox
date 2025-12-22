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
def lockers_status():
    """Get combined status of all lockers from sensors and server."""
    try:
        # Get sensor status from Arduino
        sensor_status = serial_ctrl.get_all_status()
        
        # Get occupation status from server
        server_data, server_status_code = api_client.get_lockers_status()
        
        # Combine: sensor tells us if door is open/closed, server tells us if occupied
        lockers = []
        for locker_id in range(1, 16):  # Lockers 1-15
            sensor_state = sensor_status.get(locker_id, "UNKNOWN")
            
            # Check if occupied from server
            occupied = False
            if server_status_code == 200 and "lockers" in server_data:
                for locker in server_data["lockers"]:
                    if locker.get("id") == locker_id and locker.get("occupied"):
                        occupied = True
                        break
            
            # Determine final status
            if sensor_state == "OPEN":
                status = "open"  # Door is physically open
            elif occupied:
                status = "occupied"  # Door closed but has package
            else:
                status = "available"  # Door closed and empty
            
            lockers.append({
                "id": locker_id,
                "status": status,
                "sensorState": sensor_state
            })
        
        return jsonify({"lockers": lockers})
    except Exception as exc:
        return jsonify({"message": f"Error getting status: {exc}"}), 500


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

