/**
 * SolarSwarm Dashboard – three layout variants, simulation + real-backend ready.
 *
 * Standalone (built-in simulation):
 *   <Dashboard />
 *
 * With real backend (pass useSolarSwarm output):
 *   const { state, actions } = useSolarSwarm('http://localhost:8000');
 *   <Dashboard
 *     backendData={state.connected ? state : null}
 *     onTriggerOutage={actions.onTriggerOutage}
 *     onReset={actions.onReset}
 *     onSetSpeed={actions.onSetSpeed}
 *   />
 */

import { useState, useEffect, useRef } from 'react';
import '../dashboard.css';

/* ── constants ─────────────────────────────────────────────────────────────── */

const COLORS = ['#ffbf47', '#3fd6c8', '#8b9bff', '#ff8b6b'];

// 4 nodes in a square around the hub
const ORB_POS = [
  { cls: 'np0', rx: 50, ry: 10 },  // top
  { cls: 'np1', rx: 90, ry: 50 },  // right
  { cls: 'np2', rx: 50, ry: 90 },  // bottom
  { cls: 'np3', rx: 10, ry: 50 },  // left
];

/* ── helpers ───────────────────────────────────────────────────────────────── */

const clock = () => new Date().toTimeString().slice(0, 8);

/** Convert backend API state to internal node format */
function adaptBackendData(backendData) {
  if (!backendData?.nodes?.length) return null;
  const LETTERS = ['A', 'B', 'C', 'D', 'E'];
  const nodes = backendData.nodes.map((n, i) => ({
    id: n.id ?? n.node_id ?? i,
    label: n.label ?? `NODE ${LETTERS[i] ?? i}`,
    name: n.name ?? (n.role === 'master' ? 'Master' : `Slave #${n.node_id ?? i + 1}`),
    role: n.role ?? 'slave',
    soc: n.soc ?? 0,
    brightness: n.brightness ?? n.brightness_actual ?? 0,
    online: n.online !== false,
    isCam: n.isCam ?? false,
  }));

  // If backend tracks camera separately, append as a node
  const cam = backendData.camera;
  if (cam && !nodes.some(n => n.isCam)) {
    nodes.push({
      id: 99,
      label: 'NODE C',
      name: 'Camera',
      role: 'camera',
      soc: cam.powered ? 75 : 0,
      brightness: cam.alive ? 100 : 0,
      online: cam.alive ?? false,
      isCam: true,
    });
  }

  return {
    nodes,
    gridUp: !backendData.swarm_active,
    swarmActive: backendData.swarm_active ?? false,
  };
}

/** Compute all derived display values from raw state */
function deriveDisplay(nodes, swarmActive, gridUp, history) {
  const online = nodes.filter(n => n.online).sort((a, b) => b.soc - a.soc || a.id - b.id);
  const primaryId = swarmActive ? (online[0]?.id ?? null) : null;

  const dnodes = nodes.map((n, i) => {
    const soc = Math.round(n.soc);
    const lit  = n.brightness > 0 && n.online;
    const glowClass = n.online && n.brightness >= 100 ? 'glow-strong' : lit ? 'glow-soft' : '';
    const isPrimary  = swarmActive && n.id === primaryId && lit;

    let statusClass, statusText;
    if (!n.online)     { statusClass = 'off';  statusText = 'OFFLINE'; }
    else if (gridUp)   { statusClass = 'grid'; statusText = 'GRID PWR'; }
    else if (lit)      { statusClass = 'lit';  statusText = isPrimary ? 'PRIMARY' : 'RELAY'; }
    else               { statusClass = 'dark'; statusText = 'STANDBY'; }

    const sc  = soc > 30 ? 'ok' : soc > 10 ? 'warn' : 'crit';
    const pos = ORB_POS[i] ?? { cls: 'np0', rx: 50, ry: 50 };

    return {
      ...n,
      soc,
      socPct: Math.max(2, Math.min(100, n.soc)),
      brightness: Math.round(n.brightness),
      notCam: !n.isCam,
      glowClass,
      barClass: 'bar-' + sc,
      statusClass,
      statusText,
      isPrimary,
      camClass: n.isCam && lit ? 'live' : 'dead',
      ringColor: sc === 'ok' ? '#5fe093' : sc === 'warn' ? '#ffbf47' : '#ff5a52',
      ringDeg: Math.round(Math.max(0, Math.min(100, n.soc)) * 3.6),
      rx: pos.rx, ry: pos.ry, orbPosClass: pos.cls,
      linkClass: lit ? 'on' : 'off',
      roleTag: n.role.toUpperCase(),
      color: COLORS[i] ?? '#888',
    };
  });

  const lightNodes = nodes.filter(n => n.online && !n.isCam);
  const coverage = lightNodes.length
    ? (lightNodes.reduce((a, n) => a + n.soc, 0) / (lightNodes.length * 10)).toFixed(1)
    : '0.0';
  const primaryLabel = primaryId != null ? (nodes.find(n => n.id === primaryId)?.label ?? '—') : '—';

  const chartLines = nodes.map((n, i) => {
    const h   = (history[n.id] ?? []).slice(-60);
    const pts = h.length < 2 ? '' : h.map((v, j) => {
      const x = (j / (h.length - 1)) * 100;
      const y = 100 - Math.max(0, Math.min(100, v));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return { label: n.label, color: COLORS[i] ?? '#888', points: pts };
  });

  let rule = 'idle';
  if (swarmActive) {
    if (!online.length || online.every(u => u.soc <= 10)) rule = 'emergency';
    else if (online[0].soc > 30) rule = 'normal';
    else if (online[0].soc > 10) rule = 'handoff';
    else                          rule = 'critical';
  }

  return {
    dnodes,
    cam: dnodes.find(d => d.isCam) ?? {},
    coverage,
    primaryLabel,
    chart: { lines: chartLines },
    gridText:  gridUp ? 'GRID UP' : 'OUTAGE ACTIVE',
    gridSub:   gridUp ? 'Mains power nominal' : 'Swarm relay engaged',
    gridClass: gridUp ? 'up' : 'out',
    ruleC: {
      normal:    rule === 'normal'    ? 'on' : '',
      handoff:   rule === 'handoff'   ? 'on' : '',
      critical:  rule === 'critical'  ? 'on' : '',
      emergency: rule === 'emergency' ? 'on' : '',
    },
  };
}

/* ── shared sub-components ─────────────────────────────────────────────────── */

function GridBadge({ cls, text, big }) {
  return (
    <span className={`grid-badge ${cls}${big ? ' gb-big' : ''}`}>
      <span className="gb-dot" />
      {text}
    </span>
  );
}

function SpeedSeg({ speed, setSpeed }) {
  return (
    <div className="seg">
      {[1, 5, 10].map(s => (
        <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>
          {s}×
        </button>
      ))}
    </div>
  );
}

function ChartSvg({ lines, gridLines = [25, 50, 75], minHeight }) {
  return (
    <div className="chart-wrap" style={minHeight ? { minHeight } : undefined}>
      <svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        {gridLines.map(y => (
          <line key={y} className="cgrid" x1="0" y1={y} x2="100" y2={y} />
        ))}
        {lines.map(ln => (
          <polyline key={ln.label} className="cline" points={ln.points} style={{ stroke: ln.color }} />
        ))}
      </svg>
    </div>
  );
}

function EventFeed({ events, maxHeight = 312 }) {
  return (
    <div className="feed" style={{ maxHeight }}>
      {events.map((e, i) => (
        <div key={i} className={`ev ev-${e.level}`}>
          <span className="ev-time">{e.timeStr}</span>
          <span className="ev-dot" />
          <span className="ev-txt">{e.text}</span>
        </div>
      ))}
    </div>
  );
}

function CamThumb({ n, camTime, big }) {
  return (
    <div className={`camthumb${big ? ' big' : ''} ${n.camClass}`}>
      <div className="cam-scan" />
      <div className="cam-rec"><span className="rec-dot" />LIVE{big ? ' · OV2640' : ''}</div>
      {big && <div className="cam-res">640×480 · MJPEG</div>}
      <div className="cam-ts">{camTime}</div>
      <div className="cam-off">
        {big ? 'STREAM OFFLINE' : 'SIGNAL LOST'}
        <span className="cam-off-sub">{big ? 'SWARM CUT POWER TO NODE C' : 'NODE POWERED DOWN'}</span>
      </div>
    </div>
  );
}

/* ── Layout 1a: Command Grid ───────────────────────────────────────────────── */

function Layout1a({ dnodes, cam, camTime, chart, events, gridUp, swarmActive, gridClass, gridText, coverage, primaryLabel, speed, setSpeed, triggerOutage, restoreGrid, reset }) {
  return (
    <div className="dash">
      <div className="dhead">
        <div>
          <div className="dh-title fs-h">Command Grid</div>
          <div className="dh-sub">5-node swarm · {primaryLabel} primary</div>
        </div>
        <GridBadge cls={gridClass} text={gridText} />
        <div className="cov">
          <span className="lbl">Est. coverage</span>
          <span className="cov-n">{coverage} h</span>
        </div>
        <div className="tb-spacer" />
        <div className="controls">
          {gridUp    && <button className="btn btn-danger" onClick={triggerOutage}>Outage</button>}
          {swarmActive && <button className="btn btn-go" onClick={restoreGrid}>Restore</button>}
          <SpeedSeg speed={speed} setSpeed={setSpeed} />
          <button className="btn" onClick={reset}>Reset</button>
        </div>
      </div>

      <div className="lay-1a">
        <div className="cards4">
          {dnodes.map(n => (
            <div key={n.id} className={`ucard ${n.glowClass}`}>
              <div className="fx ac jb">
                <div>
                  <div className="uc-label">{n.label}</div>
                  <div className="uc-name">{n.name}</div>
                </div>
                <span className={`tag tag-${n.role}`}>{n.roleTag}</span>
              </div>

              {n.notCam && (
                <div className="fx gap12">
                  <div className="socbar">
                    <div className={`socbar-fill ${n.barClass}`} style={{ height: `${n.socPct}%` }} />
                  </div>
                  <div className="f1">
                    <div className="big">{n.soc}<span className="pct">%</span></div>
                    <div className="lbl">State of charge</div>
                    <div className="bri">
                      <div className="bri-row">
                        <span className="lbl">Brightness</span>
                        <span className="mono-v">{n.brightness}%</span>
                      </div>
                      <div className="britrack"><div className="brifill" style={{ width: `${n.brightness}%` }} /></div>
                    </div>
                  </div>
                </div>
              )}

              {n.isCam && (
                <>
                  <CamThumb n={n} camTime={camTime} />
                  <div className="bri">
                    <div className="bri-row">
                      <span className="lbl">Power</span>
                      <span className="mono-v">{n.brightness}%</span>
                    </div>
                  </div>
                </>
              )}

              <div className="fx ac jb uc-foot">
                <span className={`status status-${n.statusClass}`}><span className="sdot" />{n.statusText}</span>
                {n.isPrimary && <span className="primary-pill">PRIMARY</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="row2">
          <div className="panel">
            <div className="panel-hd"><span>STATE OF CHARGE · LAST 10 MIN</span><span className="lbl">SOC %</span></div>
            <ChartSvg lines={chart.lines} />
            <div className="legend">
              {chart.lines.map(ln => (
                <span key={ln.label} className="leg">
                  <span className="leg-sw" style={{ background: ln.color }} />{ln.label}
                </span>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-hd">
              <span>EVENT FEED</span>
              <span className="status status-grid"><span className="sdot" />LIVE</span>
            </div>
            <EventFeed events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Layout 1b: Swarm Radial ───────────────────────────────────────────────── */

function Layout1b({ dnodes, chart, events, gridUp, swarmActive, gridClass, gridText, coverage, primaryLabel, speed, setSpeed, triggerOutage, restoreGrid }) {
  return (
    <div className="dash">
      <div className="dhead">
        <div>
          <div className="dh-title fs-h">Swarm Radial</div>
          <div className="dh-sub">Relay topology · live baton-pass</div>
        </div>
        <GridBadge cls={gridClass} text={gridText} />
        <div className="tb-spacer" />
        <div className="controls">
          {gridUp      && <button className="btn btn-danger" onClick={triggerOutage}>Outage</button>}
          {swarmActive && <button className="btn btn-go" onClick={restoreGrid}>Restore</button>}
          <SpeedSeg speed={speed} setSpeed={setSpeed} />
        </div>
      </div>

      <div className="lay-1b">
        {/* left: unit list */}
        <div className="panel">
          <div className="panel-hd"><span>UNITS</span><span className="lbl">{coverage}h</span></div>
          {dnodes.map(n => (
            <div key={n.id} className="nrow">
              <span className="nrow-lbl">{n.label}</span>
              <div className="hbar"><div className={`hbar-fill ${n.barClass}`} style={{ width: `${n.socPct}%` }} /></div>
              <span className="nrow-soc">{n.soc}</span>
            </div>
          ))}
        </div>

        {/* center: radial + trend */}
        <div className="lay-1b-center">
          <div className="panel">
            <div className="panel-hd">
              <span>SWARM RELAY TOPOLOGY</span>
              <span className="status status-lit"><span className="sdot" />{primaryLabel} PRIMARY</span>
            </div>
            <div className="radial-stage">
              <svg className="rad-links" viewBox="0 0 100 100" preserveAspectRatio="none">
                {dnodes.map(n => (
                  <line key={n.id} className={`rlink ${n.linkClass}`}
                    x1="50" y1="50" x2={n.rx} y2={n.ry} />
                ))}
              </svg>
              <div className="hub"><div className="hub-core">SWARM<br />ENGINE</div></div>
              {dnodes.map(n => (
                <div key={n.id} className={`orb ${n.orbPosClass} ${n.glowClass}`}>
                  <div className="orb-ring"
                    style={{ background: `conic-gradient(${n.ringColor} ${n.ringDeg}deg,rgba(255,255,255,.07) 0)` }}>
                    <div className="orb-inner">
                      <div className="orb-soc">{n.soc}</div>
                      <div className="orb-tag">{n.label}</div>
                    </div>
                  </div>
                  <div className="orb-name">{n.name}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-hd"><span>SOC TREND</span><span className="lbl">10 MIN</span></div>
            <ChartSvg lines={chart.lines} gridLines={[50]} minHeight="128px" />
          </div>
        </div>

        {/* right: event feed */}
        <div className="panel">
          <div className="panel-hd">
            <span>EVENT FEED</span>
            <span className="status status-grid"><span className="sdot" />LIVE</span>
          </div>
          <EventFeed events={events} maxHeight={400} />
        </div>
      </div>
    </div>
  );
}

/* ── Layout 1c: Telemetry Wall ─────────────────────────────────────────────── */

function Layout1c({ dnodes, cam, camTime, chart, events, gridUp, swarmActive, gridClass, gridText, gridSub, coverage, ruleC, speed, setSpeed, triggerOutage, restoreGrid, reset }) {
  return (
    <div className="dash">
      <div className="dhead">
        <div className="dh-title fs-h">Telemetry Wall</div>
        <div className="dh-sub">Engineering view · swarm_engine.py state</div>
        <div className="tb-spacer" />
        <div className="controls">
          <SpeedSeg speed={speed} setSpeed={setSpeed} />
        </div>
      </div>

      <div className="lay-1c">
        {/* left rail */}
        <div className="rail">
          <div className="railblock">
            <div className="lbl">Grid status</div>
            <GridBadge cls={gridClass} text={gridText} big />
            <div className="dh-sub" style={{ marginTop: 8, textAlign: 'center', color: '#7c8593' }}>{gridSub}</div>
          </div>
          <div className="railblock">
            <div className="lbl">Est. coverage remaining</div>
            <div className="bignum">{coverage}<span className="pct">h</span></div>
          </div>
          <div className="railblock">
            <div className="lbl">Demo controls</div>
            <div className="ctrl-col">
              {gridUp      && <button className="btn btn-danger" onClick={triggerOutage}>Simulate Outage</button>}
              {swarmActive && <button className="btn btn-go" onClick={restoreGrid}>Restore Grid</button>}
              <button className="btn" onClick={reset}>Reset Demo</button>
            </div>
          </div>
          <div className="railblock">
            <div className="lbl">Swarm algorithm</div>
            <div className={`rule ${ruleC.normal}`}>   <span className="rule-dot" />SOC {'>'} 30% → primary 100%</div>
            <div className={`rule ${ruleC.handoff}`}>  <span className="rule-dot" />10–30% → handoff 50 / 50</div>
            <div className={`rule ${ruleC.critical}`}> <span className="rule-dot" />{'<'} 10% → 5% / backup 100%</div>
            <div className={`rule ${ruleC.emergency}`}><span className="rule-dot" />all {'<'} 10% → emergency 5%</div>
          </div>
        </div>

        {/* center */}
        <div className="lay-1c-center">
          <div className="panel">
            <div className="panel-hd"><span>STATE OF CHARGE · ALL NODES</span><span className="lbl">SOC %</span></div>
            <ChartSvg lines={chart.lines} minHeight="208px" />
            <div className="legend">
              {chart.lines.map(ln => (
                <span key={ln.label} className="leg">
                  <span className="leg-sw" style={{ background: ln.color }} />{ln.label}
                </span>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-hd">
              <span>NODE C · POWER-CONTROL PROOF</span>
              <span className={`status status-${cam.statusClass ?? 'dark'}`}>
                <span className="sdot" />{cam.statusText ?? 'STANDBY'}
              </span>
            </div>
            <CamThumb n={cam.camClass ? cam : { camClass: 'dead', isCam: true }} camTime={camTime} big />
          </div>
        </div>

        {/* right: unit compact cards */}
        <div className="lay-1c-right">
          <div className="lbl" style={{ padding: '2px 2px 0' }}>Units</div>
          {dnodes.map(n => (
            <div key={n.id} className={`ccard ${n.glowClass}`}>
              <div className="cc-id">
                <div className="uc-label">{n.label}</div>
                <span className={`tag tag-${n.role}`}>{n.roleTag}</span>
              </div>
              <div className="cc-mid">
                <div className="bri-row">
                  <span className={`status status-${n.statusClass}`}><span className="sdot" />{n.statusText}</span>
                  <span className="mono-v">PWM {n.brightness}%</span>
                </div>
                <div className="hbar"><div className={`hbar-fill ${n.barClass}`} style={{ width: `${n.socPct}%` }} /></div>
              </div>
              <div className="cc-soc">{n.soc}<span className="pct" style={{ fontSize: 11 }}>%</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* bottom ticker */}
      <div className="tickwrap">
        <div className="ticker">
          <span className="tk-lbl">EVENT LOG</span>
          <div className="tk-items">
            {events.slice(0, 10).map((e, i) => (
              <span key={i} className="tk-item">
                <span className="tk-t">{e.timeStr}</span>{e.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────────────────────────────────── */

export default function Dashboard({
  backendData = null,
  liveCamera = null,
  onTriggerOutage = null,
  onReset = null,
  onSetSpeed = null,
}) {
  const [view, setView] = useState('1a');
  const [camTime, setCamTime] = useState(clock());

  // Clock tick (1 s)
  useEffect(() => {
    const id = setInterval(() => setCamTime(clock()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── all data comes from backend ───────────────────────────────────────────
  const adapted = backendData ? adaptBackendData(backendData) : null;

  const baseNodes = adapted?.nodes ?? [];
  const effectiveNodes = liveCamera
    ? baseNodes.map(n =>
        n.isCam
          ? { ...n, online: liveCamera.alive ?? false, brightness: liveCamera.alive ? n.brightness : 0 }
          : n
      )
    : baseNodes;

  const effectiveGridUp      = adapted?.gridUp      ?? true;
  const effectiveSwarmActive = adapted?.swarmActive  ?? false;
  const effectiveHistory     = backendData?.history  ?? {};
  const effectiveEvents      = backendData?.events   ?? [];

  const display = deriveDisplay(effectiveNodes, effectiveSwarmActive, effectiveGridUp, effectiveHistory);

  // ── actions always go to backend ──────────────────────────────────────────
  const triggerOutage = () => onTriggerOutage?.();
  const restoreGrid   = () => onReset?.();
  const reset         = () => onReset?.();
  const setSpeed      = (speed) => onSetSpeed?.(speed);

  // ── connecting / loading state ────────────────────────────────────────────
  if (!adapted) {
    return (
      <>
        <div className="topbar">
          <div className="tb-brand"><span className="tb-dot" />SOLARSWARM</div>
          <span className="dh-sub">MVP TELEMETRY · CONNECTING…</span>
          <div className="tb-spacer" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12, color: '#7c8593', fontSize: 15 }}>
          <div style={{ fontSize: 32, opacity: 0.25 }}>◎</div>
          Connecting to SolarSwarm backend…
          <span style={{ fontSize: 12, opacity: 0.55 }}>Make sure the backend is running at localhost:8000</span>
        </div>
      </>
    );
  }

  // ── shared props passed to every layout ───────────────────────────────────
  const sharedProps = {
    ...display,
    camTime,
    gridUp:      effectiveGridUp,
    swarmActive: effectiveSwarmActive,
    speed:       backendData?.demo_speed ?? 1,
    events:      effectiveEvents.slice(0, 20),
    setSpeed,
    triggerOutage,
    restoreGrid,
    reset,
  };

  return (
    <>
      <div className="topbar">
        <div className="tb-brand">
          <span className="tb-dot" />
          SOLARSWARM
        </div>
        <span className="dh-sub">MVP TELEMETRY · LIVE BACKEND</span>
        <div className="tb-spacer" />
        <GridBadge cls={display.gridClass} text={display.gridText} />
        <div className="view-switcher">
          {[['1a', 'Grid'], ['1b', 'Radial'], ['1c', 'Telemetry']].map(([v, label]) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 18px 32px' }}>
        {view === '1a' && <Layout1a {...sharedProps} />}
        {view === '1b' && <Layout1b {...sharedProps} />}
        {view === '1c' && <Layout1c {...sharedProps} />}
      </div>
    </>
  );
}
