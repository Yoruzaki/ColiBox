import os
import time
from flask import Flask, jsonify, render_template, request
from serial_controller import SerialController, SerialError
from api_client import ApiClient


SERVER_BASE_URL = os.environ.get("SERVER_BASE_URL", "http://localhost:5000")
LOCKER_ID = int(os.environ.get("LOCKER_ID", "1"))  # ID de la machine entière
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


def _validate_box(box_id: int):
    """Valider l'ID de la box (compartiment) - 1 à 15"""
    if box_id == 16:
        return False, ("Box 16 est réservée", 400)
    if box_id < 1 or box_id > 16:
        return False, ("ID de box invalide", 400)
    return True, None


@app.route("/api/deposit/open", methods=["POST"])
def deposit_open():
    """
    Dépôt: Le client envoie seulement le code de suivi.
    Le serveur décide quelle box utiliser et retourne boxId.
    """
    data = request.get_json(force=True)
    tracking_code = data.get("trackingCode")
    
    if not tracking_code:
        return jsonify({"message": "Code de suivi requis"}), 400

    # Appeler le serveur avec l'ID du locker (machine)
    server_resp, status_code = api_client.open_deposit(LOCKER_ID, tracking_code)
    if status_code != 200:
        return jsonify(server_resp), status_code

    # Le serveur retourne boxId (le compartiment à utiliser)
    box_id = server_resp.get("boxId")
    if not box_id:
        return jsonify({"message": "Le serveur n'a pas retourné de boxId"}), 500
    
    ok, error = _validate_box(box_id)
    if not ok:
        msg, code = error
        return jsonify({"message": msg}), code

    # Ouvrir la box physique via Arduino
    try:
        serial_ctrl.open_locker(box_id)
    except SerialError as exc:
        return jsonify({"message": f"Erreur série: {exc}"}), 500

    return jsonify(server_resp)


@app.route("/api/deposit/close", methods=["POST"])
def deposit_close():
    """
    Confirmer la fermeture après dépôt.
    """
    data = request.get_json(force=True)
    box_id = int(data.get("boxId", 0))
    closet_id = int(data.get("closetId", 0))
    tracking_code = data.get("trackingCode")
    
    ok, error = _validate_box(box_id)
    if not ok:
        msg, code = error
        return jsonify({"message": msg}), code
        
    if not (closet_id and tracking_code):
        return jsonify({"message": "closetId et trackingCode requis"}), 400

    # Vérifier que la box est fermée
    if not serial_ctrl.verify_closed(box_id):
        return jsonify({"message": "La box est encore ouverte"}), 409

    # Confirmer au serveur
    server_resp, status_code = api_client.close_deposit(LOCKER_ID, box_id, closet_id, tracking_code)
    return jsonify(server_resp), status_code


@app.route("/api/withdraw/open", methods=["POST"])
def withdraw_open():
    """
    Retrait: Le client envoie seulement le mot de passe.
    Le serveur trouve la box correspondante et retourne boxId.
    """
    data = request.get_json(force=True)
    password = data.get("password")
    
    if not password:
        return jsonify({"message": "Mot de passe requis"}), 400

    # Appeler le serveur avec l'ID du locker (machine) et le mot de passe
    server_resp, status_code = api_client.open_withdraw(LOCKER_ID, password)
    if status_code != 200:
        return jsonify(server_resp), status_code

    # Le serveur retourne boxId (le compartiment contenant le colis)
    box_id = server_resp.get("boxId")
    if not box_id:
        return jsonify({"message": "Le serveur n'a pas retourné de boxId"}), 500
    
    ok, error = _validate_box(box_id)
    if not ok:
        msg, code = error
        return jsonify({"message": msg}), code

    # Ouvrir la box physique via Arduino
    try:
        serial_ctrl.open_locker(box_id)
    except SerialError as exc:
        return jsonify({"message": f"Erreur série: {exc}"}), 500

    return jsonify(server_resp)


@app.route("/api/withdraw/close", methods=["POST"])
def withdraw_close():
    """
    Confirmer la fermeture après retrait.
    """
    data = request.get_json(force=True)
    box_id = int(data.get("boxId", 0))
    closet_id = int(data.get("closetId", 0))
    
    ok, error = _validate_box(box_id)
    if not ok:
        msg, code = error
        return jsonify({"message": msg}), code
        
    if not closet_id:
        return jsonify({"message": "closetId requis"}), 400

    # Vérifier que la box est fermée
    if not serial_ctrl.verify_closed(box_id):
        return jsonify({"message": "La box est encore ouverte"}), 409

    # Confirmer au serveur
    server_resp, status_code = api_client.close_withdraw(LOCKER_ID, box_id, closet_id)
    return jsonify(server_resp), status_code


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
