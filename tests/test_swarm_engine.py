from backend.swarm_engine import compute_brightness


def test_swarm_inactive_returns_zeros():
    units = {0: {"soc": 80}, 1: {"soc": 60}}
    result = compute_brightness(units, swarm_active=False)
    assert result == {0: 0, 1: 0}


def test_single_node_high_soc():
    units = {0: {"soc": 80, "online": True}}
    result = compute_brightness(units, swarm_active=True)
    assert result[0] == 100


def test_primary_is_highest_soc():
    units = {0: {"soc": 50}, 1: {"soc": 90}}
    result = compute_brightness(units, swarm_active=True)
    assert result[1] == 100
    assert result[0] == 0


def test_tie_breaking_lower_id_wins():
    units = {0: {"soc": 70}, 1: {"soc": 70}}
    result = compute_brightness(units, swarm_active=True)
    assert result[0] == 100
    assert result[1] == 0


def test_dimming_range_primary_between_10_and_30():
    units = {0: {"soc": 20}, 1: {"soc": 15}}
    result = compute_brightness(units, swarm_active=True)
    assert result[0] == 50
    assert result[1] == 50


def test_handoff_primary_below_10():
    units = {0: {"soc": 8}, 1: {"soc": 50}}
    result = compute_brightness(units, swarm_active=True)
    assert result[1] == 100
    assert result[0] == 0


def test_handoff_primary_below_10_backup_becomes_primary():
    units = {0: {"soc": 5}, 1: {"soc": 40}}
    result = compute_brightness(units, swarm_active=True)
    assert result[1] == 100
    assert result[0] == 0


def test_emergency_all_below_10():
    units = {0: {"soc": 8}, 1: {"soc": 5}, 2: {"soc": 3}}
    result = compute_brightness(units, swarm_active=True)
    assert all(v == 5 for v in result.values())


def test_offline_node_excluded():
    units = {0: {"soc": 80, "online": True}, 1: {"soc": 90, "online": False}}
    result = compute_brightness(units, swarm_active=True)
    assert result[0] == 100
    assert result[1] == 0


def test_all_offline_returns_zeros():
    units = {0: {"soc": 80, "online": False}, 1: {"soc": 90, "online": False}}
    result = compute_brightness(units, swarm_active=True)
    assert result == {0: 0, 1: 0}


def test_four_nodes_highest_soc_primary():
    units = {
        0: {"soc": 50},
        1: {"soc": 91},
        2: {"soc": 70},
        3: {"soc": 30},
    }
    result = compute_brightness(units, swarm_active=True)
    assert result[1] == 100
    assert result[0] == 0
    assert result[2] == 0
    assert result[3] == 0


def test_soc_field_name_not_battery_pct():
    units = {0: {"soc": 80}}
    result = compute_brightness(units, swarm_active=True)
    assert result[0] == 100
