from __future__ import annotations

from typing import Optional

HANDOFF_THRESHOLD = 20
CRITICAL_THRESHOLD = 10

_current_primary: Optional[int] = None


def _pick_highest_soc(online: dict) -> int:
    return sorted(online.items(), key=lambda x: (-x[1]["soc"], x[0]))[0][0]


def _pick_backup(online: dict, exclude: int):
    candidates = {uid: u for uid, u in online.items()
                  if uid != exclude and u["soc"] > CRITICAL_THRESHOLD}
    if not candidates:
        return None
    return _pick_highest_soc(candidates)


def compute_brightness(units: dict, swarm_active: bool) -> dict:
    global _current_primary

    if not swarm_active:
        _current_primary = None
        return {uid: 0 for uid in units}

    online = {uid: u for uid, u in units.items() if u.get("online", True)}
    if not online:
        return {uid: 0 for uid in units}

    if all(u["soc"] <= 0 for u in online.values()):
        return {uid: 0 for uid in units}

    if all(u["soc"] <= CRITICAL_THRESHOLD for u in online.values()):
        return {uid: 5 for uid in units}

    # Keep current primary unless it went offline
    if _current_primary is None or _current_primary not in online:
        _current_primary = _pick_highest_soc(online)

    result = {uid: 0 for uid in units}
    primary_soc = online[_current_primary]["soc"]

    if primary_soc > HANDOFF_THRESHOLD:
        result[_current_primary] = 100
    elif primary_soc > CRITICAL_THRESHOLD:
        # Handoff zone: dim primary, ramp backup
        backup_id = _pick_backup(online, _current_primary)
        if backup_id is not None:
            result[_current_primary] = 50
            result[backup_id] = 50
        else:
            result[_current_primary] = 100
    else:
        # Primary is critical: hand off completely
        backup_id = _pick_backup(online, _current_primary)
        result[_current_primary] = 5
        if backup_id is not None:
            result[backup_id] = 100
            _current_primary = backup_id
        else:
            result[_current_primary] = 100

    return result


def reset():
    global _current_primary
    _current_primary = None
