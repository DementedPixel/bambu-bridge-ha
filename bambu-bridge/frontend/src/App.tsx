import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { PrinterCard } from './components/PrinterCard';
import { getBasePath, getWsUrl } from './utils/basePath';
import './App.css';

interface PrinterInfo {
  id: string;
  name: string;
}

function App() {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const { statuses, connected: wsConnected } = useWebSocket(getWsUrl('ws'));

  useEffect(() => {
    fetch(`${getBasePath()}/api/printers`)
      .then((res) => res.json())
      .then((data: Array<{ id: string; name: string }>) => {
        setPrinters(data.map((p) => ({ id: p.id, name: p.name })));
      })
      .catch((err) => console.error('Failed to load printers:', err));
  }, []);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Printer Dashboard</h1>
        <span className={`ws-status ${wsConnected ? 'connected' : 'disconnected'}`}>
          {wsConnected ? 'Live' : 'Reconnecting...'}
        </span>
      </header>
      <div className="printer-grid">
        {printers.map((p) => (
          <PrinterCard
            key={p.id}
            id={p.id}
            name={p.name}
            connected={!!statuses[p.id]}
            status={statuses[p.id] || {}}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
