import { useEffect, useRef, useState } from "react";

export type StreamStatus = "idle" | "connecting" | "live" | "error";

export interface MarketTick {
  seq: number;
  seed: number;
  ts: number;
}

/**
 * Subscribes to the server's SSE market feed. Each tick carries a seed the
 * client applies to the local deterministic market simulation.
 */
export function useMarketStream(
  enabled: boolean,
  onTick: (tick: MarketTick) => void,
  intervalMs = 2000,
) {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [lastTick, setLastTick] = useState<MarketTick | null>(null);
  const handler = useRef(onTick);
  handler.current = onTick;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setStatus("idle");
      return;
    }
    setStatus("connecting");
    const source = new EventSource(`/api/market-stream?interval=${intervalMs}`);

    source.addEventListener("hello", () => setStatus("live"));
    source.addEventListener("tick", (e) => {
      setStatus("live");
      try {
        const tick = JSON.parse((e as MessageEvent).data) as MarketTick;
        setLastTick(tick);
        handler.current(tick);
      } catch {
        /* ignore malformed frame */
      }
    });
    source.onerror = () => setStatus("error");

    return () => {
      source.close();
      setStatus("idle");
    };
  }, [enabled, intervalMs]);

  return { status, lastTick };
}
