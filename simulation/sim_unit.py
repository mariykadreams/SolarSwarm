"""
Simulated SolarSwarm node — mimics an ESP32 sending POST /api/uplink.
Run two instances: python sim_unit.py --node-id 2 and --node-id 3.
"""
import argparse
import json
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError

BACKEND_URL = "http://localhost:8000/api/uplink"
DRAIN_RATE_ACTIVE = 0.5   # % SOC per tick when lamp is on
DRAIN_RATE_STANDBY = 0.05  # % SOC per tick when standby (10x slower)
TICK_SECONDS = 5
INITIAL_SOC = 95.0


def get_demo_speed(base_url: str) -> float:
    try:
        req = Request(base_url.replace("/api/uplink", "/api/state"))
        with urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read())
            return data.get("demo_speed", 1.0)
    except Exception:
        return 1.0


def run(node_id: int, outage: bool = False):
    soc = INITIAL_SOC
    grid_status = 0 if outage else 1
    brightness_actual = 0

    print(f"[sim] Starting simulated node {node_id}, SOC={soc}%")

    while True:
        speed = get_demo_speed(BACKEND_URL)
        drain = DRAIN_RATE_ACTIVE if brightness_actual > 0 else DRAIN_RATE_STANDBY
        soc = max(0, soc - drain * speed)

        payload = {
            "nodes": [
                {
                    "node_id": node_id,
                    "role": "simulated",
                    "soc": round(soc, 1),
                    "light_level": 0,
                    "brightness_actual": brightness_actual,
                    "grid_status": grid_status,
                    "online": True,
                    "ts": datetime.now(timezone.utc).isoformat(),
                }
            ]
        }

        try:
            body = json.dumps(payload).encode()
            req = Request(BACKEND_URL, data=body,
                          headers={"Content-Type": "application/json"})
            with urlopen(req, timeout=5) as resp:
                result = json.loads(resp.read())
                for cmd in result.get("commands", []):
                    if cmd["node_id"] == node_id:
                        brightness_actual = cmd["brightness"]
            print(f"[sim node {node_id}] SOC={soc:.1f}% brightness={brightness_actual} speed={speed}×")
        except URLError as e:
            print(f"[sim node {node_id}] POST failed: {e}")

        time.sleep(TICK_SECONDS / speed if speed > 0 else TICK_SECONDS)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SolarSwarm simulated node")
    parser.add_argument("--node-id", type=int, required=True, help="Node ID (use 2 or 3)")
    parser.add_argument("--outage", action="store_true", help="Simulate grid outage (grid_status=0)")
    args = parser.parse_args()
    run(args.node_id, outage=args.outage)
