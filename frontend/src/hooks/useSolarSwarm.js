/**
 * useSolarSwarm – live connection to the SolarSwarm FastAPI backend.
 *
 * Uses Vite's dev-server proxy, so all URLs are relative:
 *   /api/*  →  http://localhost:8000/api/*
 *   /ws     →  ws://localhost:8000/ws
 *
 * Returns { state, actions }:
 *   state.connected  – true once the WebSocket handshake succeeds
 *   state.nodes      – [] until the first /api/uplink from hardware
 *   actions.*        – call backend simulation endpoints
 */

import { useState, useEffect } from 'react';

const LABEL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const clock = () => new Date().toTimeString().slice(0, 8);

/** Map a raw API node to the internal format Dashboard expects */
function mapNode(apiNode, index) {
  return {
    id: apiNode.node_id,
    label: `NODE ${LABEL_LETTERS[index] ?? index}`,
    name: apiNode.role === 'master' ? 'Master' : `Slave #${apiNode.node_id}`,
    role: apiNode.role ?? 'slave',
    soc: apiNode.soc ?? 0,
    brightness: apiNode.brightness ?? 0,
    online: apiNode.online !== false,
    isCam: false,
  };
}

export function useSolarSwarm() {
  const [state, setState] = useState({
    nodes: [],
    swarm_active: false,
    demo_speed: 1,
    camera: { powered: false, alive: false, ip: '' },
    events: [],
    history: {},
    connected: false,  // WebSocket handshake succeeded
    reachable: false,  // REST /api/state returned 200 (set before WS opens)
  });

  useEffect(() => {
    let destroyed = false;
    let ws = null;
    let reconnectTimer = null;
    let reconnectDelay = 1000; // ms; doubles on each failure, caps at 10 s

    // ── 1. Fetch current state then open WebSocket ─────────────────────────
    async function init() {
      let initialNodes = [];
      try {
        const res  = await fetch('/api/state');
        const data = await res.json();

        if (destroyed) return;

        initialNodes = (data.nodes ?? []).map(mapNode);

        // Fetch SOC history in parallel for every known node
        const historyResults = await Promise.allSettled(
          initialNodes.map(n =>
            fetch(`/api/history?node_id=${n.id}&limit=120`)
              .then(r => r.json())
              .then(d => ({ id: n.id, rows: d.history ?? [] }))
          )
        );
        const history = {};
        for (const r of historyResults) {
          if (r.status === 'fulfilled') {
            const { id, rows } = r.value;
            // rows are DESC from DB — reverse to get chronological order
            history[id] = [...rows].reverse().map(row => row.soc);
          }
        }
        // Seed history with current SOC if empty
        initialNodes.forEach(n => {
          if (!history[n.id]?.length) history[n.id] = [n.soc];
        });

        setState(s => ({
          ...s,
          nodes: initialNodes,
          swarm_active: data.swarm_active ?? false,
          demo_speed: data.demo_speed ?? 1,
          camera: data.camera ?? s.camera,
          history,
          reachable: true,
        }));
      } catch {
        // Backend not running yet — Dashboard will fall back to simulation
      }

      // ── 2. Open WebSocket ────────────────────────────────────────────────
      if (destroyed) return;
      try {
        const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${wsProto}//${location.host}/ws`);

        ws.onopen = () => {
          if (!destroyed) {
            reconnectDelay = 1000; // reset backoff on successful connect
            setState(s => ({ ...s, connected: true }));
          }
        };

        ws.onclose = () => {
          if (!destroyed) {
            setState(s => ({ ...s, connected: false }));
            // Re-fetch state then reconnect (per architecture plan §5)
            reconnectTimer = setTimeout(() => {
              if (!destroyed) {
                reconnectDelay = Math.min(reconnectDelay * 2, 10000);
                init();
              }
            }, reconnectDelay);
          }
        };

        ws.onerror = () => {
          if (!destroyed) setState(s => ({ ...s, connected: false }));
        };

        ws.onmessage = (e) => {
          if (destroyed) return;
          let msg;
          try { msg = JSON.parse(e.data); } catch { return; }

          setState(s => {
            // ── state_update: live node telemetry ─────────────────────────
            if (msg.type === 'state_update') {
              const nodes = s.nodes.map(n =>
                n.id === msg.node_id
                  ? {
                      ...n,
                      soc:        msg.soc        ?? n.soc,
                      brightness: msg.brightness ?? n.brightness,
                      online:     msg.online     ?? n.online,
                    }
                  : n
              );
              const history = { ...s.history };
              history[msg.node_id] = [
                ...(history[msg.node_id] ?? []),
                msg.soc ?? 0,
              ].slice(-120);
              const swarm_active =
                msg.grid_status === 0 ? true
                : msg.grid_status === 1 ? false
                : s.swarm_active;
              return { ...s, nodes, history, swarm_active };
            }

            // ── camera_update ─────────────────────────────────────────────
            if (msg.type === 'camera_update') {
              return {
                ...s,
                camera: {
                  powered: msg.powered ?? false,
                  alive:   msg.alive   ?? false,
                  ip:      msg.ip      ?? '',
                },
              };
            }

            // ── alert → push to event feed ────────────────────────────────
            if (msg.type === 'alert') {
              return {
                ...s,
                events: [
                  { level: msg.level ?? 'info', text: msg.message ?? '', timeStr: clock() },
                  ...s.events,
                ].slice(0, 40),
              };
            }

            // ── swarm_event → format relay messages before pushing ────────
            if (msg.type === 'swarm_event') {
              const LETTERS = ['A', 'B', 'C', 'D', 'E'];
              let text = msg.message;
              let level = 'relay';
              if (!text) {
                if (msg.event === 'relay_start') {
                  const from = msg.from_unit != null ? `NODE ${LETTERS[msg.from_unit] ?? msg.from_unit}` : '';
                  const to   = msg.to_unit   != null ? `NODE ${LETTERS[msg.to_unit]   ?? msg.to_unit}`   : '';
                  const soc  = msg.soc_trigger != null ? ` (SOC ${msg.soc_trigger}%)` : '';
                  text = from ? `RELAY HANDOFF — ${from} → ${to}${soc}` : `RELAY START — ${to}${soc}`;
                } else if (msg.event === 'relay_complete') {
                  const from = msg.from_unit != null ? `NODE ${LETTERS[msg.from_unit] ?? msg.from_unit}` : '';
                  const to   = msg.to_unit   != null ? `NODE ${LETTERS[msg.to_unit]   ?? msg.to_unit}`   : '';
                  const dur  = msg.duration_s != null ? ` in ${msg.duration_s.toFixed(1)}s` : '';
                  text = `RELAY COMPLETE — ${from} → ${to}${dur}`;
                } else if (msg.event === 'camera_online') {
                  text = 'Camera power restored — stream resuming';
                  level = 'info';
                } else {
                  text = msg.event ?? '';
                  level = 'info';
                }
              }
              return {
                ...s,
                events: [
                  { level, text, timeStr: clock() },
                  ...s.events,
                ].slice(0, 40),
              };
            }

            return s;
          });
        };
      } catch {
        // WebSocket unavailable — schedule retry
        if (!destroyed) {
          reconnectTimer = setTimeout(() => {
            if (!destroyed) {
              reconnectDelay = Math.min(reconnectDelay * 2, 10000);
              init();
            }
          }, reconnectDelay);
        }
      }
    }

    init();

    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []); // run once on mount

  // ── camera status poll (every 5 s) ───────────────────────────────────────
  // Keeps the camera alive/powered state current even when no WS messages
  // are coming (e.g. no hardware posting uplinks yet).
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/camera/status');
        if (!res.ok) return;
        const cam = await res.json();
        setState(s => ({ ...s, camera: cam, reachable: true }));
      } catch {}
    };
    poll(); // immediate first poll
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  // ── actions ──────────────────────────────────────────────────────────────

  const post = (path) =>
    fetch(path, { method: 'POST' }).catch(() => {});

  const postJson = (path, body) =>
    fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});

  const actions = {
    onTriggerOutage: () => post('/api/simulate/outage'),
    onReset:         () => post('/api/simulate/reset'),
    onSetSpeed:      (speed) => postJson('/api/simulate/speed', { speed }),
  };

  return { state, actions };
}
