import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-Sent Events feed standing in for the Kafka consumer.
 * Emits a deterministic tick seed every `intervalMs` so every connected
 * client advances the market simulation in lockstep.
 */
export const Route = createFileRoute("/api/market-stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const intervalMs = Math.min(
          10000,
          Math.max(500, Number(url.searchParams.get("interval") ?? 2000) || 2000),
        );

        const encoder = new TextEncoder();
        let seq = 0;
        let timer: ReturnType<typeof setInterval> | undefined;

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

            send("hello", { intervalMs, ts: Date.now() });

            timer = setInterval(() => {
              seq += 1;
              send("tick", {
                seq,
                seed: 1000 + Math.floor(Date.now() / 1000) + seq,
                ts: Date.now(),
              });
            }, intervalMs);

            request.signal.addEventListener("abort", () => {
              if (timer) clearInterval(timer);
              try {
                controller.close();
              } catch {
                /* noop */
              }
            });
          },
          cancel() {
            if (timer) clearInterval(timer);
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
