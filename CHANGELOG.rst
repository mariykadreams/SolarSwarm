Changelog
=========

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
