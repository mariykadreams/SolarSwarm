def compute_brightness(units: dict, swarm_active: bool) -> dict:
    if not swarm_active:
        return {uid: 0 for uid in units}

    online = {uid: u for uid, u in units.items() if u.get("online", True)}
    if not online:
        return {uid: 0 for uid in units}

    queue = sorted(online.items(), key=lambda x: (-x[1]["soc"], x[0]))

    if all(u["soc"] <= 10 for _, u in queue):
        return {uid: 5 for uid in units}

    result = {uid: 0 for uid in units}
    primary_id, primary = queue[0]
    backup_id, backup = queue[1] if len(queue) > 1 else (None, None)

    if primary["soc"] > 30:
        result[primary_id] = 100
    elif primary["soc"] > 10:
        result[primary_id] = 50
        if backup_id is not None:
            result[backup_id] = 50
    else:
        result[primary_id] = 5
        if backup_id is not None:
            result[backup_id] = 100

    return result
