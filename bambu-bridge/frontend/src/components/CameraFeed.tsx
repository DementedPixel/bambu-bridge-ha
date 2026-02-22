import { useState, useEffect } from 'react';
import { getBasePath } from '../utils/basePath';

interface CameraFeedProps {
  printerId: string;
}

export function CameraFeed({ printerId }: CameraFeedProps) {
  const [src, setSrc] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setSrc(`${getBasePath()}/api/printers/${printerId}/snapshot?t=${Date.now()}`);
    };
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [printerId]);

  return (
    <div className="camera-feed">
      {!loaded && !error && <div className="camera-placeholder">Loading camera...</div>}
      {error && <div className="camera-placeholder camera-error">Camera unavailable</div>}
      <img
        src={src}
        alt={`${printerId} camera`}
        onLoad={() => { setLoaded(true); setError(false); }}
        onError={() => { setError(true); setLoaded(false); }}
        style={{ display: loaded ? 'block' : 'none' }}
      />
    </div>
  );
}
