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


def _box_allowed(box_number: int) -> bool:
    """Box 16 est réservée"""
    return 1 <= box_number <= 15


def _generate_closet_id():
    return random.randint(1000, 9999)


def _generate_password():
    return "".join(random.choices(string.digits, k=6))


def _get_locker_by_machine_id(db, machine_id: int):
    """Récupérer le locker par son ID machine"""
    return db.execute(
        "SELECT id, machine_id, name, status FROM lockers WHERE machine_id=?",
        (machine_id,)
    ).fetchone()


def _find_available_box(db, locker_id: int):
    """Trouver une box disponible (exclut box 16)"""
    box = db.execute(
        """
        SELECT id, box_number FROM boxes 
        WHERE locker_id=? AND status='available' AND box_number <= 15
        ORDER BY box_number
        LIMIT 1
        """,
        (locker_id,)
    ).fetchone()
    return box


@bp.route("/")
def index():
    db = _get_db()
    
    # Récupérer toutes les boxes avec leur statut
    boxes = db.execute(
        """
        SELECT b.id, b.box_number, b.status, l.machine_id, l.name as locker_name
        FROM boxes b
        JOIN lockers l ON b.locker_id = l.id
        ORDER BY l.machine_id, b.box_number
        """
    ).fetchall()
    
    # Récupérer les dernières commandes
    orders = db.execute(
        """
        SELECT o.id, l.machine_id, b.box_number, o.closet_id, o.tracking_code, 
               o.password, o.order_type, o.status, o.created_at
        FROM orders o
        JOIN lockers l ON o.locker_id = l.id
        JOIN boxes b ON o.box_id = b.id
        ORDER BY o.created_at DESC 
        LIMIT 20
        """
    ).fetchall()
    
    return render_template("index.html", boxes=boxes, orders=orders)


@bp.route("/boxes/<int:box_id>/reset", methods=["POST"])
def reset_box(box_id):
    db = _get_db()
    db.execute("UPDATE boxes SET status='available' WHERE id=?", (box_id,))
    db.execute("UPDATE orders SET status='cancelled' WHERE box_id=? AND status NOT IN ('closed', 'withdrawn')", (box_id,))
    db.commit()
    return redirect(url_for("routes.index"))


@bp.route("/api/deposit/open", methods=["POST"])
def open_deposit():
    """
    Dépôt: Le client envoie tracking_code + machine_id.
    Le serveur trouve une box disponible et la retourne.
    """
    payload = request.get_json(force=True)
    machine_id = int(payload.get("lockerId", 0))  # ID de la machine
    tracking_code = payload.get("trackingCode")

    if not machine_id:
        return jsonify({"message": "lockerId requis"}), 400
    if not tracking_code:
        return jsonify({"message": "trackingCode requis"}), 400

    db = _get_db()
    
    # Récupérer la machine
    locker = _get_locker_by_machine_id(db, machine_id)
    if not locker:
        return jsonify({"message": "Machine non trouvée"}), 404
    if locker["status"] != "active":
        return jsonify({"message": "Machine non disponible"}), 409

    # Trouver une box disponible
    box = _find_available_box(db, locker["id"])
    if not box:
        return jsonify({"message": "Aucune box disponible"}), 409

    closet_id = _generate_closet_id()
    
    # Marquer la box comme occupée
    db.execute("UPDATE boxes SET status='deposit_open' WHERE id=?", (box["id"],))
    
    # Créer la commande
    db.execute(
        """
        INSERT INTO orders (locker_id, box_id, closet_id, tracking_code, order_type, status) 
        VALUES (?, ?, ?, ?, 'deposit', 'awaiting_close')
        """,
        (locker["id"], box["id"], closet_id, tracking_code),
    )
    db.commit()
    
    return jsonify({
        "boxId": box["box_number"],  # Retourne le numéro de box (1-15)
        "closetId": closet_id,
        "message": f"Box {box['box_number']} assignée, déposez votre colis"
    })


@bp.route("/api/deposit/close", methods=["POST"])
def close_deposit():
    """
    Fermeture dépôt: Le client confirme la fermeture.
    Le serveur génère et retourne le mot de passe.
    """
    payload = request.get_json(force=True)
    machine_id = int(payload.get("lockerId", 0))
    box_number = int(payload.get("boxId", 0))  # Numéro de box
    closet_id = int(payload.get("closetId", 0))
    tracking_code = payload.get("trackingCode")

    if not (machine_id and box_number and closet_id and tracking_code):
        return jsonify({"message": "Paramètres manquants"}), 400

    if not _box_allowed(box_number):
        return jsonify({"message": "Box non valide"}), 400

    db = _get_db()
    
    # Récupérer la machine et la box
    locker = _get_locker_by_machine_id(db, machine_id)
    if not locker:
        return jsonify({"message": "Machine non trouvée"}), 404
    
    box = db.execute(
        "SELECT id FROM boxes WHERE locker_id=? AND box_number=?",
        (locker["id"], box_number)
    ).fetchone()
    if not box:
        return jsonify({"message": "Box non trouvée"}), 404

    # Récupérer la commande
    order = db.execute(
        """
        SELECT id, status FROM orders 
        WHERE box_id=? AND closet_id=? AND tracking_code=? AND order_type='deposit'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (box["id"], closet_id, tracking_code),
    ).fetchone()
    
    if not order:
        return jsonify({"message": "Commande non trouvée"}), 404
    if order["status"] != "awaiting_close":
        return jsonify({"message": "État de commande invalide"}), 409

    # Générer le mot de passe
    password = _generate_password()
    
    # Mettre à jour
    db.execute("UPDATE boxes SET status='occupied' WHERE id=?", (box["id"],))
    db.execute(
        "UPDATE orders SET status='closed', password=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (password, order["id"]),
    )
    db.commit()
    
    return jsonify({
        "boxId": box_number,
        "closetId": closet_id,
        "password": password,
        "orderId": order["id"],
        "message": "Dépôt terminé"
    })


@bp.route("/api/withdraw/open", methods=["POST"])
def open_withdraw():
    """
    Retrait: Le client envoie password + machine_id.
    Le serveur trouve la box correspondante et la retourne.
    """
    payload = request.get_json(force=True)
    machine_id = int(payload.get("lockerId", 0))
    password = payload.get("password")

    if not (machine_id and password):
        return jsonify({"message": "Paramètres manquants"}), 400

    db = _get_db()
    
    # Récupérer la machine
    locker = _get_locker_by_machine_id(db, machine_id)
    if not locker:
        return jsonify({"message": "Machine non trouvée"}), 404

    # Trouver la commande avec ce mot de passe
    order = db.execute(
        """
        SELECT o.id, o.closet_id, o.status, b.id as box_id, b.box_number, b.status as box_status
        FROM orders o
        JOIN boxes b ON o.box_id = b.id
        WHERE o.locker_id=? AND o.password=? AND o.order_type='deposit' 
        ORDER BY o.created_at DESC
        LIMIT 1
        """,
        (locker["id"], password),
    ).fetchone()
    
    if not order:
        return jsonify({"message": "Mot de passe invalide"}), 404
    if order["status"] != "closed":
        return jsonify({"message": "Colis déjà retiré ou non disponible"}), 409
    if order["box_status"] != "occupied":
        return jsonify({"message": "Box non occupée"}), 409

    # Marquer comme retrait en cours
    db.execute("UPDATE boxes SET status='withdraw_open' WHERE id=?", (order["box_id"],))
    db.execute(
        "UPDATE orders SET status='withdraw_in_progress', updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (order["id"],),
    )
    db.commit()
    
    return jsonify({
        "boxId": order["box_number"],  # Retourne le numéro de box
        "closetId": order["closet_id"],
        "orderId": order["id"],
        "message": f"Box {order['box_number']} ouverte, retirez votre colis"
    })


@bp.route("/api/withdraw/close", methods=["POST"])
def close_withdraw():
    """
    Fermeture retrait: Le client confirme avoir récupéré le colis.
    """
    payload = request.get_json(force=True)
    machine_id = int(payload.get("lockerId", 0))
    box_number = int(payload.get("boxId", 0))
    closet_id = int(payload.get("closetId", 0))

    if not (machine_id and box_number and closet_id):
        return jsonify({"message": "Paramètres manquants"}), 400

    db = _get_db()
    
    # Récupérer la machine et la box
    locker = _get_locker_by_machine_id(db, machine_id)
    if not locker:
        return jsonify({"message": "Machine non trouvée"}), 404
    
    box = db.execute(
        "SELECT id FROM boxes WHERE locker_id=? AND box_number=?",
        (locker["id"], box_number)
    ).fetchone()
    if not box:
        return jsonify({"message": "Box non trouvée"}), 404

    # Récupérer la commande
    order = db.execute(
        """
        SELECT id, status FROM orders 
        WHERE box_id=? AND closet_id=? AND order_type='deposit'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (box["id"], closet_id),
    ).fetchone()
    
    if not order:
        return jsonify({"message": "Commande non trouvée"}), 404
    if order["status"] != "withdraw_in_progress":
        return jsonify({"message": "État de commande invalide"}), 409

    # Libérer la box
    db.execute("UPDATE boxes SET status='available' WHERE id=?", (box["id"],))
    db.execute(
        "UPDATE orders SET status='withdrawn', updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (order["id"],),
    )
    db.commit()
    
    return jsonify({
        "boxId": box_number,
        "closetId": closet_id,
        "message": "Retrait terminé"
    })
