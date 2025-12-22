import requests


class ApiClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def open_deposit(self, locker_id: int, tracking_code: str):
        return self._post("/api/deposit/open", {"lockerId": locker_id, "trackingCode": tracking_code})

    def close_deposit(self, locker_id: int, closet_id: int, tracking_code: str):
        return self._post(
            "/api/deposit/close",
            {"lockerId": locker_id, "closetId": closet_id, "trackingCode": tracking_code},
        )

    def open_withdraw(self, locker_id: int, password: str):
        return self._post("/api/withdraw/open", {"lockerId": locker_id, "password": password})

    def close_withdraw(self, locker_id: int, closet_id: int):
        return self._post("/api/withdraw/close", {"lockerId": locker_id, "closetId": closet_id})

    def get_occupied_lockers(self):
        """Get list of occupied locker IDs from server"""
        try:
            resp = requests.get(f"{self.base_url}/api/lockers/occupied", timeout=3)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("occupied", []), resp.status_code
            return [], resp.status_code
        except Exception:  # pragma: no cover
            return [], 503
    
    def _post(self, path: str, body: dict):
        try:
            resp = requests.post(f"{self.base_url}{path}", json=body, timeout=5)
            return resp.json(), resp.status_code
        except Exception as exc:  # pragma: no cover
            return {"message": f"Server unreachable: {exc}"}, 503

