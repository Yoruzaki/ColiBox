import time
import logging
from typing import Optional

try:
    import serial
except ImportError:  # pragma: no cover
    serial = None  # type: ignore


LOG = logging.getLogger(__name__)


class SerialError(Exception):
    pass


class SerialController:
    def __init__(self, port: str, baud: int = 115200, timeout: float = 2.0):
        self.port = port
        self.baud = baud
        self.timeout = timeout
        self._serial = None
        self._connect()

    def _connect(self):
        if serial is None:
            LOG.warning("pyserial not installed; running in simulation mode")
            return
        try:
            self._serial = serial.Serial(self.port, self.baud, timeout=self.timeout)
            time.sleep(2)  # allow Arduino reset
        except Exception as exc:  # pragma: no cover
            LOG.error("Serial connection failed: %s", exc)
            self._serial = None

    def _send_command(self, command: str) -> str:
        if self._serial is None:
            LOG.info("Simulated serial command: %s", command)
            return "OK"
        try:
            self._serial.reset_input_buffer()
            self._serial.write((command + "\n").encode("utf-8"))
            self._serial.flush()
            response = self._serial.readline().decode("utf-8").strip()
            LOG.debug("Serial response: %s", response)
            return response or "OK"
        except Exception as exc:  # pragma: no cover
            raise SerialError(str(exc))

    def ping(self) -> bool:
        resp = self._send_command("PING")
        return resp.upper() == "OK"

    def open_locker(self, locker_id: int):
        resp = self._send_command(f"OPEN:{locker_id}")
        if "ERR" in resp.upper():
            raise SerialError(resp)

    def verify_closed(self, locker_id: int) -> bool:
        resp = self._send_command(f"READ:{locker_id}")
        # Expecting response like "CLOSED" or "OPEN"
        return resp.upper() == "CLOSED"
    
    def get_all_status(self) -> dict:
        """Get status of all lockers (1-15). Returns dict with locker_id: status."""
        resp = self._send_command("STATUS")
        # Expected format: "1:CLOSED,2:OPEN,3:CLOSED,..."
        statuses = {}
        if resp and resp.upper() != "OK":
            for part in resp.split(","):
                if ":" in part:
                    try:
                        locker_id, status = part.split(":")
                        statuses[int(locker_id)] = status.upper()
                    except ValueError:
                        continue
        return statuses

