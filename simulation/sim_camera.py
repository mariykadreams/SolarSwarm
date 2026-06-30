"""
Simulated camera — sends heartbeat to backend every 3 seconds.
Camera is "alive" only while this script is running.
Stop it (Ctrl+C) to simulate power cut.
"""
import json
import time
from urllib.request import Request, urlopen
from urllib.error import URLError

BACKEND_URL = "http://localhost:8000"
HEARTBEAT_INTERVAL = 2


def run():
    print("[camera] Starting simulated camera heartbeat")

    while True:
        try:
            # Check if any node is providing power
            with urlopen(BACKEND_URL + "/api/state", timeout=3) as resp:
                state = json.loads(resp.read())

            has_power = any(
                n.get("brightness", 0) > 0 or n.get("brightness_actual", 0) > 0
                for n in state.get("nodes", [])
            )

            if has_power:
                body = json.dumps({"ip": "192.168.1.50"}).encode()
                req = Request(BACKEND_URL + "/api/camera/heartbeat",
                              data=body, headers={"Content-Type": "application/json"})
                with urlopen(req, timeout=3) as resp:
                    pass
                print("[camera] LIVE | powered=True")
            else:
                print("[camera] OFFLINE | no power from nodes")

        except URLError as e:
            print(f"[camera] check failed: {e}")

        time.sleep(HEARTBEAT_INTERVAL)


if __name__ == "__main__":
    run()
