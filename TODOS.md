# SolarSwarm TODOs

Items captured during engineering reviews. Ordered by strategic value.

---

## Post-Hackathon

### TODO-1: Decentralized (edge) swarm relay algorithm

**What:** Implement the swarm relay decision logic on the ESP32 microcontrollers themselves, so relay decisions happen peer-to-peer via ESP-NOW without a backend.

**Why:** The current centralized design requires a backend to be running for relay to fire. If the backend is unreachable (cloud failure, no WiFi), nodes hold last-commanded brightness — they don't dynamically relay. In a real city deployment where the backend may be 5km away over a cellular link, this is a single point of failure for the entire swarm coordination. Decentralized relay eliminates it.

**Pros:** Swarm survives backend failure. True autonomous operation — no internet required. Stronger product moat (most competitors have centralized control only).

**Cons:** More complex firmware. Need consensus protocol for nodes to agree on priority order. Multi-hop ESP-NOW (for >2 nodes) adds routing complexity.

**Context:** The hackathon demo uses centralized backend because it's simpler and the swarm algorithm already exists in Python. The API contract (POST /api/uplink + response brightness) would be preserved — just the decision logic moves from backend to firmware. Start with: research LoRa/ESP-NOW peer-to-peer mesh (not LoRaWAN). RadioLib supports point-to-point ESP-NOW without gateway.

**Depends on:** v1 hackathon demo proving the concept. After judging, design the firmware state machine for a 2-node version first, then extend to N nodes.

---
