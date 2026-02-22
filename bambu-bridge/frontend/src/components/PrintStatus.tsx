import type { PrinterStatus } from '../types';

interface PrintStatusProps {
  status: PrinterStatus;
}

const STATE_COLORS: Record<string, string> = {
  IDLE: '#6b7280',
  RUNNING: '#22c55e',
  PAUSE: '#eab308',
  FINISH: '#3b82f6',
  FAILED: '#ef4444',
};

function formatTime(minutes: number): string {
  if (minutes <= 0) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function PrintStatus({ status }: PrintStatusProps) {
  const state = status.gcode_state || 'UNKNOWN';
  const percent = status.mc_percent ?? 0;
  const remaining = status.mc_remaining_time ?? 0;
  const layer = status.layer_num ?? 0;
  const totalLayers = status.total_layer_num ?? 0;
  const isActive = state === 'RUNNING' || state === 'PAUSE';

  return (
    <div className="print-status">
      <div className="status-header">
        <span
          className="state-badge"
          style={{ backgroundColor: STATE_COLORS[state] || '#6b7280' }}
        >
          {state}
        </span>
        {status.subtask_name && (
          <span className="job-name" title={status.subtask_name}>
            {status.subtask_name}
          </span>
        )}
      </div>

      {isActive && (
        <>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${percent}%` }} />
            <span className="progress-text">{percent}%</span>
          </div>
          <div className="status-details">
            <span>Layer {layer} / {totalLayers}</span>
            <span>{formatTime(remaining)} remaining</span>
          </div>
        </>
      )}

      {state === 'FAILED' && status.print_error !== undefined && status.print_error !== 0 && (
        <div className="error-info">Error code: {status.print_error}</div>
      )}
    </div>
  );
}
