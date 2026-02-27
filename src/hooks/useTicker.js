import { useEffect, useState } from 'react';

// Forces a re-render every `intervalMs` so relative timestamps stay fresh
export function useTicker(intervalMs = 30_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
