import { useEffect, useRef, useState } from "react";

export type StreamStatus = "idle" | "connecting" | "live" | "error" | "reconnecting";

export interface MarketTick {
  seq: number;
  seed: number;
  ts: number;
}

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

/**
 * Subscribes to the server's SSE market feed. Each tick carries a seed the
 * client applies to the local deterministic market simulation.
 *
 * On network drops the connection is re-established with exponential backoff
 * (1s → 2s → 4s … capped at 30s, plus jitter). The most recent tick is kept in
 * state across reconnects so the dashboard never blanks out while offline.
 */
export function useMarketStream(
  enabled: boolean,
  onTick: (tick: MarketTick) => void,
  intervalMs = 2000,
) {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [lastTick, setLastTick] = useState<MarketTick | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const handler = useRef(onTick);
  handler.current = onTick;

  // Preserved across reconnects so the resumed feed keeps counting up.
  const lastTickRef = useRef<MarketTick | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setStatus("idle");
      setRetryCount(0);
      return;
    }

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let closed = false;

    const connect = () => {
      if (closed) return;
      setStatus(attempt === 0 ? "connecting" : "reconnecting");

      const resumeFrom = lastTickRef.current?.seq ?? 0;
      source = new EventSource(
        `/api/market-stream?interval=${intervalMs}&since=${resumeFrom}`,
      );

      const markLive = () => {
        attempt = 0;
        setRetryCount(0);
        setStatus("live");
      };

      source.addEventListener("hello", markLive);
      source.addEventListener("tick", (e) => {
        markLive();
        try {
          const tick = JSON.parse((e as MessageEvent).data) as MarketTick;
          lastTickRef.current = tick;
          setLastTick(tick);
          handler.current(tick);
        } catch {
          /* ignore malformed frame */
        }
      });

      source.onerror = () => {
        if (closed) return;
        source?.close();
        source = null;
        attempt += 1;
        setRetryCount(attempt);
        setStatus("reconnecting");
        const delay =
          Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1)) *
          (0.75 + Math.random() * 0.5);
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
      setStatus("idle");
    };
  }, [enabled, intervalMs]);

  return { status, lastTick, retryCount };
}
