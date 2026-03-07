import { useEffect, useRef } from 'react';

export function useWebSocket({ sessionName, enabled = true, onMessage, onError, onOpen, onClose }) {
  const wsRef = useRef(null);
  const retryTimerRef = useRef(null);

  // Use refs for callbacks to avoid reconnecting when they change
  const cbRef = useRef({ onMessage, onError, onOpen, onClose });
  cbRef.current = { onMessage, onError, onOpen, onClose };

  useEffect(() => {
    if (!enabled || !sessionName) return undefined;

    let closedByCleanup = false;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws/sessions/${encodeURIComponent(sessionName)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => cbRef.current.onOpen?.();

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          cbRef.current.onMessage?.(payload);
        } catch (error) {
          cbRef.current.onError?.(error);
        }
      };

      ws.onerror = () => cbRef.current.onError?.(new Error('WebSocket error'));

      ws.onclose = () => {
        wsRef.current = null;
        cbRef.current.onClose?.();
        if (!closedByCleanup) {
          retryTimerRef.current = window.setTimeout(connect, 2000);
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
  }, [enabled, sessionName]); // Only reconnect when session changes
}
