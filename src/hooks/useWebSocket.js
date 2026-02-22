import { useEffect, useRef } from 'react';

export function useWebSocket({ sessionName, enabled = true, onMessage, onError }) {
  const wsRef = useRef(null);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    if (!enabled || !sessionName) {
      return undefined;
    }

    let closedByCleanup = false;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws/sessions/${encodeURIComponent(sessionName)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          onMessage?.(payload);
        } catch (error) {
          onError?.(error);
        }
      };

      ws.onerror = () => {
        onError?.(new Error('WebSocket connection error'));
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!closedByCleanup) {
          retryTimerRef.current = window.setTimeout(connect, 1000);
        }
      };
    };

    connect();

    return () => {
      closedByCleanup = true;
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [enabled, sessionName, onMessage, onError]);
}
