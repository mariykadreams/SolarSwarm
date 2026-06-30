from backend.swarm_engine import compute_brightness, reset
import pytest


@pytest.fixture(autouse=True)
def clean():
    reset()
    yield
    reset()


def test_swarm_inactive_returns_zeros():
    units = {0: {"soc": 80}, 1: {"soc": 60}}
    assert compute_brightness(units, swarm_active=False) == {0: 0, 1: 0}


def test_first_call_picks_highest_soc():
    units = {1: {"soc": 50}, 2: {"soc": 90}, 3: {"soc": 70}}
    result = compute_brightness(units, swarm_active=True)
    assert result[2] == 100
    assert result[1] == 0
    assert result[3] == 0


def test_primary_stays_even_if_not_highest():
    units = {1: {"soc": 80}, 2: {"soc": 90}}
    # First call: node 2 becomes primary (highest)
    compute_brightness(units, swarm_active=True)
    # Now node 2 drains but is still above threshold
    units[2]["soc"] = 60
    units[1]["soc"] = 80
    result = compute_brightness(units, swarm_active=True)
    # Node 2 stays primary even though node 1 has more charge
    assert result[2] == 100
    assert result[1] == 0


def test_handoff_starts_at_threshold():
    units = {1: {"soc": 80}, 2: {"soc": 90}}
    compute_brightness(units, swarm_active=True)  # node 2 primary
    units[2]["soc"] = 18  # below 20% threshold
    result = compute_brightness(units, swarm_active=True)
    assert result[2] == 50  # dimming
    assert result[1] == 50  # ramping up


def test_handoff_completes_below_critical():
    units = {1: {"soc": 80}, 2: {"soc": 90}}
    compute_brightness(units, swarm_active=True)  # node 2 primary
    units[2]["soc"] = 8  # below 10% critical
    result = compute_brightness(units, swarm_active=True)
    assert result[2] == 5   # minimum
    assert result[1] == 100  # new primary
    # Next call: node 1 is now primary
    result = compute_brightness(units, swarm_active=True)
    assert result[1] == 100


def test_emergency_all_below_critical():
    units = {1: {"soc": 8}, 2: {"soc": 5}, 3: {"soc": 3}}
    result = compute_brightness(units, swarm_active=True)
    assert all(v == 5 for v in result.values())


def test_offline_node_excluded():
    units = {1: {"soc": 80, "online": True}, 2: {"soc": 90, "online": False}}
    result = compute_brightness(units, swarm_active=True)
    assert result[1] == 100
    assert result[2] == 0


def test_all_offline_returns_zeros():
    units = {1: {"soc": 80, "online": False}, 2: {"soc": 90, "online": False}}
    assert compute_brightness(units, swarm_active=True) == {1: 0, 2: 0}


def test_single_node_stays_primary():
    units = {1: {"soc": 50}}
    result = compute_brightness(units, swarm_active=True)
    assert result[1] == 100


def test_single_node_no_handoff_partner():
    units = {1: {"soc": 15}}
    result = compute_brightness(units, swarm_active=True)
    assert result[1] == 100


def test_three_node_full_relay():
    units = {1: {"soc": 90}, 2: {"soc": 85}, 3: {"soc": 80}}
    # Node 1 starts as primary
    r = compute_brightness(units, swarm_active=True)
    assert r[1] == 100

    # Node 1 drains to handoff zone
    units[1]["soc"] = 15
    r = compute_brightness(units, swarm_active=True)
    assert r[1] == 50  # dimming
    assert r[2] == 50  # backup ramping (highest remaining)

    # Node 1 critical — handoff complete to node 2
    units[1]["soc"] = 5
    r = compute_brightness(units, swarm_active=True)
    assert r[1] == 5
    assert r[2] == 100  # new primary

    # Node 2 now drains
    units[2]["soc"] = 8
    r = compute_brightness(units, swarm_active=True)
    assert r[2] == 5
    assert r[3] == 100  # node 3 takes over


def test_soc_field_name_not_battery_pct():
    units = {1: {"soc": 80}}
    result = compute_brightness(units, swarm_active=True)
    assert result[1] == 100


def test_primary_goes_offline_picks_new():
    units = {1: {"soc": 70}, 2: {"soc": 60}}
    compute_brightness(units, swarm_active=True)  # node 1 primary
    units[1]["online"] = False
    result = compute_brightness(units, swarm_active=True)
    assert result[2] == 100
    assert result[1] == 0
