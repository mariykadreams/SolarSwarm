from __future__ import annotations

import time
import logging

logger = logging.getLogger(__name__)

HEARTBEAT_TIMEOUT_S = 5


class Camera:
    def __init__(self):
        self.powered: bool = False
        self.last_heartbeat: float = 0
        self.ip: str = ""

    @property
    def alive(self) -> bool:
        if not self.powered:
            return False
        if self.last_heartbeat == 0:
            return False
        return (time.time() - self.last_heartbeat) < HEARTBEAT_TIMEOUT_S

    def heartbeat(self, ip: str = ""):
        self.last_heartbeat = time.time()
        self.powered = True
        if ip:
            self.ip = ip

    def power_off(self):
        self.powered = False

    def to_dict(self) -> dict:
        return {
            "powered": self.powered,
            "alive": self.alive,
            "ip": self.ip,
            "last_seen_s": round(time.time() - self.last_heartbeat, 1) if self.last_heartbeat else None,
        }


camera = Camera()
