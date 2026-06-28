# SolarSwarm — Simple Architecture Guide

---

## What We're Building

Two ESP32s control LED strips and simulate a swarm of solar street lights. One connects to WiFi (Master), the other talks only via ESP-NOW (Slave). A Python backend runs the swarm logic. A React dashboard shows everything live.

---

## The Two ESP32s

**Node A — Master**
- Connects to WiFi
- Reads its photoresistor and simulated battery level
- Sends data for BOTH nodes to the backend every 5 seconds
- Gets brightness commands back from the backend
- Applies its own brightness to its LED strip
- Forwards the Slave's brightness command via ESP-NOW

**Node B — Slave**
- No WiFi at all
- Reads its photoresistor and simulated battery level
- Sends data to the Master every 5 seconds via ESP-NOW
- Receives brightness commands from the Master and applies them
- If no signal for 30+ seconds: holds last brightness (stays on)

---

## Communication Flow

```
[Slave]  ──telemetry (ESP-NOW)──►  [Master]  ──POST /api/uplink──►  [Backend]
[Slave]  ◄──brightness (ESP-NOW)── [Master]  ◄──brightness cmds───  [Backend]
                                                                          │
                                                    [Dashboard]  ◄──WebSocket──┘
```

1. Slave sends data to Master via ESP-NOW every 5s
2. Master bundles both nodes' data and POSTs to backend every 5s
3. Backend returns brightness commands for both nodes
4. Master applies its own brightness, forwards Slave's command via ESP-NOW
5. Backend pushes a WebSocket update to the dashboard after each POST

---

## What the Master Sends to the Backend

```json
{
  "nodes": [
    {
      "node_id": 0,
      "role": "master",
      "soc": 87,
      "light_level": 245,
      "brightness_actual": 100,
      "grid_status": 1,
      "online": true,
      "ts": "2026-06-28T10:00:00Z"
    },
    {
      "node_id": 1,
      "role": "slave",
      "soc": 91,
      "light_level": 312,
      "brightness_actual": 60,
      "grid_status": 1,
      "online": true,
      "ts": "2026-06-28T09:59:59Z",
      "slave_age_ms": 1200
    }
  ]
}
```

> `slave_age_ms` = how old the Slave's data is (ms). If over 15000, the backend marks the Slave as offline.

> Use `soc`, not `battery_pct` — the swarm engine reads `soc` and will crash otherwise.

---

## What the Backend Sends Back

```json
{
  "commands": [
    {"node_id": 0, "brightness": 0,   "mode": "auto", "swarm_active": true},
    {"node_id": 1, "brightness": 100, "mode": "auto", "swarm_active": true}
  ]
}
```

The node with the higher battery (soc) becomes primary and gets brightness 100.

---

## Backend API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/uplink` | Receive data from Master, return brightness commands |
| GET | `/api/state` | Current state of all nodes (dashboard page load) |
| GET | `/api/history` | Last 10 minutes of SOC readings (for chart) |
| WS | `/ws` | Live updates pushed to dashboard |
| POST | `/api/simulate/outage` | Trigger a grid outage (demo button) |
| POST | `/api/simulate/reset` | Reset all SOC to 95% (demo button) |
| POST | `/api/simulate/speed` | Set drain speed: `{"rate": 10}` |

---

## Swarm Logic (runs in the backend)

Sort all online nodes by battery level (highest first). Then:

| Primary battery | Primary brightness | Backup brightness |
|----------------|--------------------|-------------------|
| Above 30%      | 100%               | 0%                |
| 10% – 30%      | 50%                | 50% (ramping up)  |
| Below 10%      | 5%                 | 100% (now primary)|
| All below 10%  | 5%                 | 5% (emergency)    |

---

## WebSocket Messages (Backend → Dashboard)

```json
// Every 5 seconds per node:
{"type": "state_update", "node_id": 0, "soc": 86, "brightness": 0}

// When relay starts:
{"type": "swarm_event", "event": "relay_start", "from_unit": 1, "to_unit": 0, "soc_trigger": 29}

// When relay finishes:
{"type": "swarm_event", "event": "relay_complete", "from_unit": 1, "to_unit": 0}

// Alerts:
{"type": "alert", "level": "warning", "message": "Node 1 SOC below 30%"}
{"type": "alert", "level": "critical", "message": "All nodes below 10%"}
```

---

## Dashboard Features

- **4 unit cards** — Node 0 (physical), Node 1 (physical), Node 2 (sim), Node 3 (sim)
  - Battery bar, SOC %, current brightness, online/offline dot
  - The active (primary) node has a bright glow
- **SOC chart** — 4 lines, last 10 minutes, live updates
- **Event feed** — relay events and alerts in reverse order
- **Demo controls** — Simulate Outage / Reset / Speed 1×/5×/10×

---

## Firmware Setup Checklist

Before flashing, configure these in both firmware files:

```cpp
// firmware/master/main.cpp and firmware/slave/main.cpp
const char*   WIFI_SSID    = "YourHotspot";      // master only
const char*   WIFI_PASS    = "YourPassword";      // master only
const char*   BACKEND_URL  = "http://192.168.X.X:8000/api/uplink";  // master only
const int     WIFI_CHANNEL = 6;    // MUST match your WiFi AP channel on BOTH devices
const float   DRAIN_RATE   = 0.5;  // MUST be the same in firmware AND simulation/sim_unit.py
const uint8_t SLAVE_MAC[]  = {0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF};  // master — Slave's MAC
const uint8_t MASTER_MAC[] = {0x11, 0x22, 0x33, 0x44, 0x55, 0x66};  // slave — Master's MAC
```

**How to find a MAC address:**
1. Flash a sketch that prints `WiFi.macAddress()` to Serial at 115200 baud
2. Open Serial Monitor, read the address
3. Copy it into the other device's firmware

---

## Critical Gotchas

**ESP-NOW channel must match WiFi channel.**
When the Master connects to WiFi, ESP-NOW uses the same channel. The Slave must be set to the same channel manually. If they differ, ESP-NOW packets drop silently — no error, LED just doesn't respond.

```cpp
// Add to Slave setup():
esp_wifi_set_channel(WIFI_CHANNEL, WIFI_SECOND_CHAN_NONE);
```

**Use `soc`, not `battery_pct` in the JSON payload.**
The backend reads `units[id]["soc"]`. If you send `battery_pct`, you get a KeyError at demo time.

**SQLite WAL mode must be enabled.**
Without it, the dashboard (reading) and the uplink handler (writing) will deadlock under concurrent access.

```python
# Add to db.py on startup:
await db.execute("PRAGMA journal_mode=WAL")
```

### Slave Fallback

If the Slave loses ESP-NOW for 30+ seconds, it keeps its last commanded brightness.

Do not fall back to photoresistor auto mode — the dashboard will show the wrong state.

---

## Implementation Order

1. **Backend stub first** (~30 min) — one route that returns `{"commands": [{"node_id": 0, "brightness": 80}]}`
2. **Then in parallel:**
   - IoT dev: Master firmware + Slave firmware (independent files)
   - Web dev: Simulation scripts + React dashboard (mock data until backend is ready)
3. **Day 2:** wire everything together and run the full relay sequence

---

## Demo Script

1. Both ESP32s powered, 2 simulation scripts running → dashboard shows 4 nodes at ~95% SOC.
2. Click **Simulate Outage** → swarm activates, primary node glows.
3. Set Speed to **10×** → SOC drains visibly on chart.
4. Watch: primary SOC hits 29% → `relay_start` event → both LEDs at 50%.
5. Primary hits 9% → `relay_complete` → backup LED at 100%, primary at 5%.
6. Click **Reset** → all back to 95%, ready to repeat.

## Architecture Notes

- **Channel of commands:** HTTP polling — Master asks the backend itself (in the POST response body), not MQTT, not WebSocket from the ESP32 side.
- **Swarm algorithm:** centralized on the backend, not on hardware.
- **Database:** SQLite + WAL mode, not PostgreSQL.
- **Slave fallback:** keeps the last brightness, not photoresistor auto mode.

## Backend to Frontend Messages

### WebSocket `/ws`

Push after each uplink:

```json
// Every 5s per node:
{"type": "state_update", "node_id": 0, "soc": 86, "brightness": 100}

// When relay starts:
{"type": "swarm_event", "event": "relay_start", "from_unit": 1, "to_unit": 0, "soc_trigger": 29}

// When relay completes:
{"type": "swarm_event", "event": "relay_complete", "from_unit": 1, "to_unit": 0, "duration_s": 4.2}

// Alerts:
{"type": "alert", "level": "warning", "message": "Node 1 SOC below 30%"}
{"type": "alert", "level": "critical", "message": "All nodes below 10%"}
{"type": "alert", "level": "info",    "message": "Grid restored"}

// If SQLite fails:
{"type": "alert", "level": "warning", "message": "DB write failed — data may be delayed"}
```

### REST on page load

```http
GET /api/state   → current state of all 4 nodes (soc, brightness, online/offline)
GET /api/history → last 120 SOC records per node (for chart)
```

## Frontend Integration Summary

- On open → `GET /api/state` + `GET /api/history`
- Connect WebSocket `/ws`
- On `state_update` → update node card
- On `swarm_event` → add to event feed + move glow
- On `alert` → add to event feed
- On WS reconnect → call `GET /api/state` again before subscribing