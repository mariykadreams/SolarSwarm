from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from . import db
from .camera import camera
from .swarm_engine import compute_brightness, reset as reset_swarm

logger = logging.getLogger(__name__)

DEMO_SPEED: float = 1.0

unit_cache: Dict[int, dict] = {}

swarm_active: bool = False



class NodePayload(BaseModel):
    node_id: int
    role: str = "master"
    soc: float
    light_level: int = 0
    brightness_actual: int = 0
    grid_status: int = 1
    rssi_wifi: Optional[int] = None
    rssi_espnow: Optional[int] = None
    online: bool = True
    ts: Optional[str] = None
    slave_age_ms: Optional[int] = None


class UplinkPayload(BaseModel):
    nodes: List[NodePayload]


class SpeedPayload(BaseModel):
    speed: float = 1.0


class ConnectionManager:
    def __init__(self):
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        self.connections.remove(ws)

    async def broadcast(self, data: dict):
        for ws in list(self.connections):
            try:
                await ws.send_json(data)
            except Exception:
                self.connections.remove(ws)


ws_manager = ConnectionManager()


async def camera_watchdog():
    was_alive = False
    while True:
        await asyncio.sleep(2)
        alive = camera.alive
        if was_alive and not alive:
            await ws_manager.broadcast({
                "type": "camera_update",
                "powered": False,
                "alive": False,
            })
            await ws_manager.broadcast({
                "type": "alert",
                "level": "warning",
                "message": "Camera power cut — stream offline",
            })
        was_alive = alive


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.get_db()
    watchdog = asyncio.create_task(camera_watchdog())
    yield
    watchdog.cancel()
    await db.close()


app = FastAPI(title="SolarSwarm Backend", lifespan=lifespan)


@app.post("/api/uplink")
async def uplink(payload: UplinkPayload):
    global swarm_active

    for node in payload.nodes:
        entry = node.model_dump()

        if node.slave_age_ms is not None and node.slave_age_ms > 15000:
            entry["online"] = False

        unit_cache[node.node_id] = entry

    if any(u.get("grid_status", 1) == 0 for u in unit_cache.values()):
        swarm_active = True

    brightness = compute_brightness(unit_cache, swarm_active)

    for nid, bri in brightness.items():
        node_data = unit_cache.get(nid, {})
        await db.write_state(
            node_id=nid,
            soc=node_data.get("soc", 0),
            brightness=bri,
            grid_status=node_data.get("grid_status", 1),
            online=node_data.get("online", True),
            ws_broadcast=ws_manager.broadcast,
        )

        await ws_manager.broadcast({
            "type": "state_update",
            "node_id": nid,
            "soc": node_data.get("soc", 0),
            "brightness": bri,
            "grid_status": node_data.get("grid_status", 1),
            "online": node_data.get("online", True),
        })

    prev_brightness = {nid: unit_cache.get(nid, {}).get("brightness_actual", 0)
                       for nid in brightness}
    for nid, bri in brightness.items():
        old = prev_brightness.get(nid, 0)
        if old == 0 and bri > 0:
            await ws_manager.broadcast({
                "type": "swarm_event",
                "event": "relay_start",
                "to_unit": nid,
                "soc_trigger": unit_cache.get(nid, {}).get("soc", 0),
            })

    max_brightness = max(brightness.values()) if brightness else 0
    was_alive = camera.alive

    if max_brightness > 0:
        camera.heartbeat()
    else:
        camera.power_off()

    if camera.alive != was_alive:
        if camera.alive:
            await ws_manager.broadcast({
                "type": "swarm_event",
                "event": "camera_online",
                "message": "Camera power restored — stream resuming",
            })
        else:
            await ws_manager.broadcast({
                "type": "alert",
                "level": "warning",
                "message": "Camera power cut — stream offline",
            })

    await ws_manager.broadcast({
        "type": "camera_update",
        **camera.to_dict(),
    })

    commands = [
        {
            "node_id": nid,
            "brightness": bri,
            "mode": "auto",
            "swarm_active": swarm_active,
        }
        for nid, bri in brightness.items()
    ]

    return {"commands": commands}


@app.get("/api/state")
async def get_state():
    nodes = []
    for nid, data in sorted(unit_cache.items()):
        nodes.append({
            "node_id": nid,
            "soc": data.get("soc", 0),
            "brightness": data.get("brightness_actual", 0),
            "grid_status": data.get("grid_status", 1),
            "online": data.get("online", True),
            "last_seen_s": 0,
        })
    return {
        "nodes": nodes,
        "swarm_active": swarm_active,
        "demo_speed": DEMO_SPEED,
        "camera": camera.to_dict(),
    }


@app.get("/api/history")
async def get_history(node_id: int, limit: int = 120):
    rows = await db.get_history(node_id, limit)
    return {"history": rows}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)


class CameraHeartbeat(BaseModel):
    ip: str = ""


@app.post("/api/camera/heartbeat")
async def camera_heartbeat(payload: CameraHeartbeat):
    was_alive = camera.alive
    camera.heartbeat(ip=payload.ip)
    if not was_alive and camera.alive:
        await ws_manager.broadcast({
            "type": "swarm_event",
            "event": "camera_online",
            "message": "Camera connected — stream live",
        })
    await ws_manager.broadcast({"type": "camera_update", **camera.to_dict()})
    return camera.to_dict()


@app.get("/api/camera/status")
async def camera_status():
    return camera.to_dict()


@app.post("/api/simulate/outage")
async def simulate_outage():
    global swarm_active
    swarm_active = True
    for nid in unit_cache:
        unit_cache[nid]["grid_status"] = 0
    await ws_manager.broadcast({
        "type": "alert",
        "level": "critical",
        "message": "Grid outage simulated — swarm activated",
    })
    return {"status": "outage_active", "swarm_active": True}


@app.post("/api/simulate/reset")
async def simulate_reset():
    global swarm_active
    swarm_active = False
    for nid in unit_cache:
        unit_cache[nid]["soc"] = 95
        unit_cache[nid]["grid_status"] = 1
    await ws_manager.broadcast({
        "type": "alert",
        "level": "info",
        "message": "Demo reset — all SOC restored to 95%",
    })
    camera.power_off()
    reset_swarm()
    return {"status": "reset_complete", "swarm_active": False}


@app.post("/api/simulate/speed")
async def simulate_speed(payload: SpeedPayload):
    global DEMO_SPEED
    DEMO_SPEED = payload.speed
    await ws_manager.broadcast({
        "type": "alert",
        "level": "info",
        "message": f"Demo speed set to {DEMO_SPEED}×",
    })
    return {"demo_speed": DEMO_SPEED}
