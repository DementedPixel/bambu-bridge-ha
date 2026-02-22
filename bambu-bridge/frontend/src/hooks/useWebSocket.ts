import { useState, useEffect, useRef, useCallback } from 'react';
import type { PrinterStatus, WsMessage } from '../types';

type StatusMap = Record<string, PrinterStatus>;

export function useWebSocket(url: string) {
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryDelayRef = useRef(1000);

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      retryDelayRef.current = 1000; // Reset backoff
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        if (msg.status) {
          setStatuses((prev) => ({
            ...prev,
            [msg.printer]: { ...(prev[msg.printer] || {}), ...msg.status },
          }));
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, 30000);
      setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close(); // Triggers onclose -> reconnect
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { statuses, connected };
}
