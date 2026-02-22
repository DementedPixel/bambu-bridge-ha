import type { PrinterStatus } from '../types';

interface TemperatureDisplayProps {
  status: PrinterStatus;
}

export function TemperatureDisplay({ status }: TemperatureDisplayProps) {
  const nozzle = status.nozzle_temper ?? 0;
  const nozzleTarget = status.nozzle_target_temper ?? 0;
  const bed = status.bed_temper ?? 0;
  const bedTarget = status.bed_target_temper ?? 0;

  return (
    <div className="temperatures">
      <div className="temp-row">
        <span className="temp-label">Nozzle</span>
        <span className="temp-value">
          {Math.round(nozzle)}&deg;C
          {nozzleTarget > 0 && (
            <span className="temp-target"> / {Math.round(nozzleTarget)}&deg;C</span>
          )}
        </span>
      </div>
      <div className="temp-row">
        <span className="temp-label">Bed</span>
        <span className="temp-value">
          {Math.round(bed)}&deg;C
          {bedTarget > 0 && (
            <span className="temp-target"> / {Math.round(bedTarget)}&deg;C</span>
          )}
        </span>
      </div>
    </div>
  );
}
