import pytest
from httpx import ASGITransport, AsyncClient

from backend.api import app, unit_cache, ws_manager
import backend.db as db_mod


@pytest.fixture(autouse=True)
async def clean_state(tmp_path):
    db_mod.DB_PATH = str(tmp_path / "test.db")
    db_mod._db = None
    unit_cache.clear()
    import backend.api as api_mod
    api_mod.swarm_active = False
    api_mod.DEMO_SPEED = 1.0
    yield
    await db_mod.close()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_stub_uplink_returns_commands(client):
    payload = {
        "nodes": [
            {"node_id": 0, "role": "master", "soc": 87, "grid_status": 1},
            {"node_id": 1, "role": "slave", "soc": 91, "grid_status": 1},
        ]
    }
    resp = await client.post("/api/uplink", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "commands" in data
    assert len(data["commands"]) == 2
    for cmd in data["commands"]:
        assert "node_id" in cmd
        assert "brightness" in cmd
        assert "mode" in cmd


@pytest.mark.anyio
async def test_uplink_slave_offline_detection(client):
    payload = {
        "nodes": [
            {"node_id": 0, "role": "master", "soc": 80, "grid_status": 0},
            {"node_id": 1, "role": "slave", "soc": 70, "grid_status": 0, "slave_age_ms": 20000},
        ]
    }
    resp = await client.post("/api/uplink", json=payload)
    assert resp.status_code == 200
    assert unit_cache[1]["online"] is False


@pytest.mark.anyio
async def test_get_state_empty(client):
    resp = await client.get("/api/state")
    assert resp.status_code == 200
    data = resp.json()
    assert data["nodes"] == []


@pytest.mark.anyio
async def test_get_state_after_uplink(client):
    await client.post("/api/uplink", json={
        "nodes": [{"node_id": 0, "role": "master", "soc": 75, "grid_status": 1}]
    })
    resp = await client.get("/api/state")
    assert len(resp.json()["nodes"]) == 1


@pytest.mark.anyio
async def test_simulate_outage(client):
    await client.post("/api/uplink", json={
        "nodes": [{"node_id": 0, "role": "master", "soc": 80, "grid_status": 1}]
    })
    resp = await client.post("/api/simulate/outage")
    assert resp.status_code == 200
    assert resp.json()["swarm_active"] is True
    assert unit_cache[0]["grid_status"] == 0


@pytest.mark.anyio
async def test_simulate_speed(client):
    resp = await client.post("/api/simulate/speed", json={"speed": 10.0})
    assert resp.status_code == 200
    assert resp.json()["demo_speed"] == 10.0


@pytest.mark.anyio
async def test_simulate_reset(client):
    await client.post("/api/uplink", json={
        "nodes": [{"node_id": 0, "role": "master", "soc": 20, "grid_status": 0}]
    })
    resp = await client.post("/api/simulate/reset")
    assert resp.status_code == 200
    assert unit_cache[0]["soc"] == 95
