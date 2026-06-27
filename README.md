# SolarSwarm

Autonomous solar street lighting with swarm coordination for grid-unstable cities.

## The Problem

Streets go dark during power outages. In Ukraine and similar regions, outages last 4–12+ hours and recur nightly. Existing solar street lights each operate independently — when one battery depletes, that light goes dark. No coordination. A street with four solar lights can still go completely dark when all four batteries deplete simultaneously.

## The Solution

SolarSwarm deploys a swarm relay algorithm (**Anti-BlackOut**) where lights coordinate like a relay race: when one unit's battery drops below 30%, the next unit (ranked by remaining charge) ramps to 100% brightness. The intersection never goes dark as long as any unit has charge remaining.

**The demo moment:** cut power to the grid → watch Light #1 dim → Light #2 automatically ramps up on the dashboard → intersection stays lit.

## Architecture

```
[Solar Panel 200W]
        ↓
[MPPT Controller] ←→ [LiFePO4 Battery 48V/25Ah = 1.2kWh]
        ↓
[LED Module 50W] ← [LED Driver] ← [DC-DC Converter]

[ESP32 Microcontroller]
  ├── Reads: Battery SOC (coulomb counter)
  ├── Reads: Grid voltage (AC sense)
  ├── Controls: LED brightness via PWM
  └── Communicates: LoRaWAN (SX1276 module)
              ↓
[LoRaWAN Gateway] → [TTN (HTTP Webhook)] → [FastAPI Backend]
                                                    ↓
                                          [Swarm Algorithm]
                                          [SQLite database]
                                                    ↓
                                          [React Dashboard]
```

**Swarm topology:** Centralized. Backend receives SOC updates every 30s, computes relay queue (sorted by SOC descending), sends brightness commands via LoRa downlink. Heartbeat downlink every 60s — if unit misses 2 heartbeats (2 min), it enters solo mode (70% brightness) independently.

## Hackathon Build (Approach C — Recommended)

1 physical light (ESP32 + LoRa) + 3 simulated lights (Python scripts) + live dashboard.

**Demo:** cut power → watch baton pass on dashboard → physical LED dims, simulated unit ramps up.

## Project Structure

```
solarswarm/
├── docs/
│   ├── design.md          # Full PRD + engineering review decisions
│   ├── research.md        # Deep research report (solar lighting + LoRaWAN)
│   └── test-plan.md       # Full test coverage plan
├── firmware/              # ESP32 firmware (LoRa uplink + PWM control)
│   └── src/
├── backend/               # FastAPI backend (swarm engine + SQLite + WebSocket)
│   └── tests/
├── simulation/            # 3 virtual light simulation scripts
└── frontend/              # React dashboard (Recharts, live WebSocket)
    └── src/
```

## LoRa Packet Format

5-byte binary payload (EU868 duty-cycle compliant):

| Byte | Field | Type |
|------|-------|------|
| 0 | unit_id | uint8 (0–3) |
| 1 | soc_percent | uint8 (0–100) |
| 2 | grid_status | uint8 (0=fail, 1=ok) |
| 3 | battery_mv_hi | uint8 (high byte) |
| 4 | battery_mv_lo | uint8 (low byte) |

## API Contract

```
POST /api/uplink      TTN webhook receiver + simulation POST target
GET  /api/state       Current SOC/brightness/grid for all 4 units
WS   /ws              Live state updates (push on every change)
```

## Energy Math

- 4 × 50W LEDs, swarm relay (1 active at a time): **0.57 kWh/night** (with overhead)
- 4 units × 1.2 kWh = **4.8 kWh total capacity**
- Theoretical autonomy: **~8.4 nights**
- Hackathon KPI: **≥48h (2 nights)** — well within margin

## KPIs

| Metric | Target |
|--------|--------|
| Coverage continuity | ≥95% of outage hours with active light |
| Swarm autonomy | ≥48h without grid |
| Relay response time | <60s from low-battery signal to handoff |
| Cost per protected night | <$10 (vs $20–50 for generator) |

## Stack

- **Firmware:** ESP32 + SX1276 LoRa module (C++/Arduino)
- **Backend:** FastAPI (Python 3.11), SQLite (aiosqlite), WebSocket
- **LoRaWAN:** The Things Network (TTN), HTTP webhook integration
- **Dashboard:** React + Recharts
- **Deploy:** Docker-compose (backend) + Vercel/Netlify (frontend)

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Simulation (3 virtual lights)
cd simulation
python sim_unit.py --unit-id 1 --initial-soc 85 &
python sim_unit.py --unit-id 2 --initial-soc 72 &
python sim_unit.py --unit-id 3 --initial-soc 65 &

# Frontend
cd frontend
npm install && npm run dev
```

## Docs

- [Design doc + PRD](docs/design.md) — full product requirements + engineering review decisions
- [Research report](docs/research.md) — solar street lighting deep research
- [Test plan](docs/test-plan.md) — full test coverage plan with E2E flows
