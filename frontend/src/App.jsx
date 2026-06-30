import Dashboard from './components/Dashboard';
import { useSolarSwarm } from './hooks/useSolarSwarm';

function App() {
  const { state, actions } = useSolarSwarm();

  // Live as soon as the WebSocket handshake succeeds — backend drives everything
  const isLive = state.connected;

  return (
    <Dashboard
      backendData={isLive ? state : null}
      // Use real camera status as soon as the backend REST API is reachable —
      // this prevents the simulation from showing NODE D as LIVE when the
      // actual camera hardware is offline.
      liveCamera={state.reachable ? state.camera : null}
      // Only wire backend actions when hardware is connected;
      // otherwise Dashboard updates its own simulation state
      onTriggerOutage={isLive ? actions.onTriggerOutage : null}
      onReset={isLive ? actions.onReset : null}
      onSetSpeed={isLive ? actions.onSetSpeed : null}
    />
  );
}

export default App;
