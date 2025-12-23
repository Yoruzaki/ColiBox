import requests


class ApiClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def open_deposit(self, locker_id: int, tracking_code: str):
        """
        Demande d'ouverture pour dépôt.
        locker_id: ID de la machine entière
        tracking_code: Code de suivi du colis
        Retour: Le serveur décide et retourne boxId
        """
        return self._post("/api/deposit/open", {"lockerId": locker_id, "trackingCode": tracking_code})

    def close_deposit(self, locker_id: int, box_id: int, closet_id: int, tracking_code: str):
        """
        Confirme la fermeture après dépôt.
        box_id: Le compartiment utilisé (retourné par open_deposit)
        """
        return self._post(
            "/api/deposit/close",
            {"lockerId": locker_id, "boxId": box_id, "closetId": closet_id, "trackingCode": tracking_code},
        )

    def open_withdraw(self, locker_id: int, password: str):
        """
        Demande d'ouverture pour retrait.
        locker_id: ID de la machine entière
        password: Mot de passe du colis
        Retour: Le serveur trouve et retourne boxId
        """
        return self._post("/api/withdraw/open", {"lockerId": locker_id, "password": password})

    def close_withdraw(self, locker_id: int, box_id: int, closet_id: int):
        """
        Confirme la fermeture après retrait.
        box_id: Le compartiment utilisé
        """
        return self._post("/api/withdraw/close", {"lockerId": locker_id, "boxId": box_id, "closetId": closet_id})

    def _post(self, path: str, body: dict):
        try:
            resp = requests.post(f"{self.base_url}{path}", json=body, timeout=5)
            return resp.json(), resp.status_code
        except Exception as exc:  # pragma: no cover
            return {"message": f"Serveur injoignable: {exc}"}, 503
