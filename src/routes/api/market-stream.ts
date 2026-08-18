import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-Sent Events feed standing in for the Kafka consumer.
 * Emits a deterministic tick seed every `intervalMs` so every connected
 * client advances the market simulation in lockstep.
 */
const HEARTBEAT_MS = 15000;

export const Route = createFileRoute("/api/market-stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const intervalMs = Math.min(
          10000,
          Math.max(500, Number(url.searchParams.get("interval") ?? 2000) || 2000),
        );

        // Clients reconnecting after a drop pass ?since=<last seq> so the
        // resumed feed keeps counting from where they left off.
        const since = Math.max(0, Number(url.searchParams.get("since") ?? 0) || 0);

        const encoder = new TextEncoder();
        let seq = since;

        let timer: ReturnType<typeof setInterval> | undefined;
        let heartbeat: ReturnType<typeof setInterval> | undefined;

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (event: string, data: unknown) => {
              try {
                controller.enqueue(
                  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
                );
              } catch {
                /* stream already closed */
              }
            };

            send("hello", { intervalMs, heartbeatMs: HEARTBEAT_MS, ts: Date.now() });

            timer = setInterval(() => {
              seq += 1;
              send("tick", {
                seq,
                seed: 1000 + Math.floor(Date.now() / 1000) + seq,
                ts: Date.now(),
              });
            }, intervalMs);

            // Keep-alive so proxies don't idle the stream out and the client
            // can detect a silently dead connection.
            heartbeat = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(": ping\n\n"));
              } catch {
                /* stream already closed */
              }
              send("heartbeat", { seq, ts: Date.now() });
            }, HEARTBEAT_MS);

            request.signal.addEventListener("abort", () => {
              if (timer) clearInterval(timer);
              if (heartbeat) clearInterval(heartbeat);
              try {
                controller.close();
              } catch {
                /* noop */
              }
            });
          },
          cancel() {
            if (timer) clearInterval(timer);
            if (heartbeat) clearInterval(heartbeat);
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
