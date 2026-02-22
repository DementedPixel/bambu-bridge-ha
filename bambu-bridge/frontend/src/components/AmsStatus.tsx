import type { PrinterStatus } from '../types';

interface AmsStatusProps {
  status: PrinterStatus;
}

export function AmsStatus({ status }: AmsStatusProps) {
  const amsUnits = status.ams?.ams;
  if (!amsUnits || amsUnits.length === 0) {
    return <div className="ams-status ams-empty">AMS not detected</div>;
  }

  // A1 has one AMS unit with 4 trays
  const trays = amsUnits[0]?.tray ?? [];

  return (
    <div className="ams-status">
      <div className="ams-label">AMS</div>
      <div className="ams-trays">
        {[0, 1, 2, 3].map((slotIndex) => {
          const tray = trays.find((t) => t.id === String(slotIndex));
          if (!tray || !tray.tray_color) {
            return (
              <div key={slotIndex} className="ams-tray ams-tray-empty">
                <div className="tray-swatch empty" />
                <span className="tray-slot">{slotIndex + 1}</span>
              </div>
            );
          }

          // tray_color is 8-char hex "RRGGBBAA" — take first 6 for CSS
          const color = `#${tray.tray_color.substring(0, 6)}`;

          return (
            <div key={slotIndex} className="ams-tray">
              <div className="tray-swatch" style={{ backgroundColor: color }} />
              <span className="tray-type">{tray.tray_type || '?'}</span>
              {tray.remain !== undefined && (
                <span className="tray-remain">{tray.remain}%</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
