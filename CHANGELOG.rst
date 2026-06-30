Changelog
=========

0.2.0 (2026-06-30)
-------------------

Added
~~~~~
* Camera support — camera pings the backend every 2 seconds. If pings stop for 5 seconds, the dashboard gets an OFFLINE notification automatically via WebSocket.
* Camera watchdog — background task that detects when camera loses power and pushes the update to all connected dashboards.
* Simulated camera script (``sim_camera.py``) for testing without real hardware.

Changed
~~~~~~~
* Relay algorithm now works like a real baton pass — one node stays primary until it drains, instead of always switching to whoever has the most charge.
* Nodes on standby now drain 10x slower than the active node (realistic battery behavior).
* When all batteries hit 0%, everything shuts off completely (no more infinite 5% emergency mode).
* System now runs with 3 nodes + camera instead of 4 nodes.
* 25 automated tests (was 19).

0.1.0 (2026-06-29)
-------------------

Added
~~~~~
* Backend server that receives data from ESP32 nodes and decides which lamp should be on.
* Swarm relay algorithm — the node with the most battery charge lights up at full brightness. When its charge drops below 30%, it starts handing off to the next node. Below 10% for everyone — emergency mode (minimal light).
* Database to store the history of each node's state (battery level, brightness, grid status).
* WebSocket support so the dashboard gets live updates without refreshing.
* Demo controls — simulate a power grid outage, reset all batteries, speed up the demo (up to 10x).
* Simulation scripts that pretend to be two extra ESP32 nodes, so the system can be tested without physical hardware.
* 19 automated tests covering the relay algorithm and all API endpoints.
