import type { PrinterStatus } from '../types';
import { CameraFeed } from './CameraFeed';
import { PrintStatus } from './PrintStatus';
import { TemperatureDisplay } from './TemperatureDisplay';
import { AmsStatus } from './AmsStatus';

interface PrinterCardProps {
  id: string;
  name: string;
  connected: boolean;
  status: PrinterStatus;
}

export function PrinterCard({ id, name, connected, status }: PrinterCardProps) {
  return (
    <div className="printer-card">
      <div className="card-header">
        <h2>{name}</h2>
        <span
          className={`connection-dot ${connected ? 'connected' : 'disconnected'}`}
          title={connected ? 'Connected' : 'Disconnected'}
        />
      </div>
      <CameraFeed printerId={id} />
      <PrintStatus status={status} />
      <TemperatureDisplay status={status} />
      <AmsStatus status={status} />
    </div>
  );
}
