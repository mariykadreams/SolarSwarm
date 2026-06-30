from __future__ import annotations

import aiosqlite
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

DB_PATH = "solarswarm.db"

_db: Optional[aiosqlite.Connection] = None


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        _db = await aiosqlite.connect(DB_PATH)
        _db.row_factory = aiosqlite.Row
        await _db.execute("PRAGMA journal_mode=WAL")
        await _db.execute("""
            CREATE TABLE IF NOT EXISTS unit_state (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id INTEGER NOT NULL,
                soc REAL NOT NULL,
                brightness INTEGER NOT NULL,
                grid_status INTEGER NOT NULL,
                online INTEGER NOT NULL DEFAULT 1,
                recorded_at TEXT DEFAULT (datetime('now'))
            )
        """)
        await _db.execute(
            "CREATE INDEX IF NOT EXISTS idx_unit_time ON unit_state(node_id, recorded_at)"
        )
        await _db.commit()
    return _db


async def write_state(node_id: int, soc: float, brightness: int,
                      grid_status: int, online: bool, ws_broadcast=None):
    try:
        db = await get_db()
        await db.execute(
            "INSERT INTO unit_state (node_id, soc, brightness, grid_status, online) VALUES (?, ?, ?, ?, ?)",
            (node_id, soc, brightness, grid_status, int(online)),
        )
        await db.commit()
    except Exception as e:
        logger.error(f"DB write failed: {e}")
        if ws_broadcast:
            await ws_broadcast({
                "type": "alert",
                "level": "warning",
                "message": "DB write failed — data may be delayed",
            })


async def get_history(node_id: int, limit: int = 120) -> List[dict]:
    db = await get_db()
    cursor = await db.execute(
        "SELECT node_id, soc, brightness, grid_status, online, recorded_at "
        "FROM unit_state WHERE node_id = ? ORDER BY recorded_at DESC LIMIT ?",
        (node_id, limit),
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def close():
    global _db
    if _db:
        await _db.close()
        _db = None
