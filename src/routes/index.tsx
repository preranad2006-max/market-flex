import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMarketStream } from "@/hooks/useMarketStream";

import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MetricStrip } from "@/components/pricing/MetricStrip";
import { SkuTable } from "@/components/pricing/SkuTable";
import { SkuDetail } from "@/components/pricing/SkuDetail";
import { Simulator, type SimState } from "@/components/pricing/Simulator";
import {
  CATEGORIES,
  generateCatalog,
  recommendPrice,
  tickMarket,
  type Sku,
} from "@/lib/pricing/engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pricing Terminal — AI Dynamic Pricing Engine" },
      {
        name: "description",
        content:
          "Real-time dynamic pricing command center: elasticity modeling, demand forecasting, flash-sale detection and stockout guardrails across 50,000+ SKUs.",
      },
      { property: "og:title", content: "Pricing Terminal — AI Dynamic Pricing Engine" },
      {
        property: "og:description",
        content:
          "Sub-second price optimization with elasticity models, competitor tracking, flash-sale detection and inventory guardrails.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Terminal,
});

const FIXED_NOW = new Date("2026-08-13T15:00:00Z");

function Terminal() {
  const [catalog, setCatalog] = useState<Sku[]>(() => generateCatalog());
  const [live, setLive] = useState(false);
  const [ticks, setTicks] = useState(0);
  const [killSwitch, setKillSwitch] = useState(false);
  const [frozenCats, setFrozenCats] = useState<Set<string>>(() => new Set());
  const [frozenSkus, setFrozenSkus] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [sim, setSim] = useState<SimState>({ stockPct: 120, compDropPct: 0, trafficMult: 1 });

  const { status: streamStatus, lastTick } = useMarketStream(live, (tick) => {
    setTicks(tick.seq);
    setCatalog((c) => tickMarket(c, tick.seed));
  });


  const isFrozen = (s: Sku) =>
    killSwitch || frozenCats.has(s.category) || frozenSkus.has(s.skuId);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog
      .filter((s) => !q || s.skuId.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .map((sku) => ({ sku, rec: recommendPrice(sku, FIXED_NOW, isFrozen(sku)) }))
      .sort((a, b) => b.rec.revenueUpliftPct - a.rec.revenueUpliftPct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, query, killSwitch, frozenCats, frozenSkus, ticks]);

  const activeId = selected || rows[0]?.sku.skuId || "";
  const activeRow = rows.find((r) => r.sku.skuId === activeId) ?? rows[0];

  const stats = useMemo(() => {
    const all = catalog.map((s) => recommendPrice(s, FIXED_NOW, isFrozen(s)));
    const base = all.reduce((a, r) => a + r.baselineRevenue, 0);
    const opt = all.reduce((a, r) => a + r.predictedRevenue, 0);
    const flash = all.filter((r) => r.flashSale).length;
    const atRisk = all.filter((r) => r.features.stockRatio < 0.5).length;
    const guarded = all.filter((r) => r.appliedRule === "STOCKOUT_GUARD").length;
    const p95 = all.map((r) => r.latencyMs).sort((a, b) => a - b)[Math.floor(all.length * 0.95)] ?? 0;
    const changed = all.filter((r) => Math.abs(r.recommendedPrice - r.currentPrice) > 0.01).length;
    return {
      uplift: base > 0 ? ((opt - base) / base) * 100 : 0,
      flash,
      atRisk,
      stockoutReduction: atRisk > 0 ? (guarded / atRisk) * 100 : 0,
      p95,
      updatesPerSec: Math.round(changed / 2),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, killSwitch, frozenCats, frozenSkus, ticks]);

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="live-dot inline-block size-2 rounded-full bg-success" />
            <span className="label-xs">Dynamic pricing engine · v1</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Pricing Terminal</h1>
          <p className="text-sm text-muted-foreground">
            Kafka signals → Redis feature store → elasticity + XGBoost demand model → constrained
            revenue optimizer.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={live} onCheckedChange={setLive} />
            Live SSE feed
          </label>
          <span
            className={
              streamStatus === "live"
                ? "label-xs text-success"
                : streamStatus === "error"
                  ? "label-xs text-destructive"
                  : "label-xs"
            }
          >
            {streamStatus === "live"
              ? `streaming · tick #${lastTick?.seq ?? 0}`
              : streamStatus === "connecting"
                ? "connecting…"
                : streamStatus === "error"
                  ? "feed disconnected"
                  : "feed idle"}
          </span>

          <label className="flex items-center gap-2 text-sm text-destructive">
            <Switch checked={killSwitch} onCheckedChange={setKillSwitch} />
            Global kill switch
          </label>
        </div>
      </header>

      {killSwitch ? (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          Automated pricing frozen globally — all SKUs holding last published price.
        </div>
      ) : null}

      <div className="mt-6">
        <MetricStrip
          metrics={[
            {
              label: "Revenue uplift",
              value: `${stats.uplift >= 0 ? "+" : ""}${stats.uplift.toFixed(1)}%`,
              sub: "optimizer vs static price",
              tone: "success",
            },
            {
              label: "Stockout mitigation",
              value: `${stats.stockoutReduction.toFixed(0)}%`,
              sub: `${stats.atRisk} SKUs below reorder`,
              tone: "accent",
            },
            {
              label: "Flash sales detected",
              value: `${stats.flash}`,
              sub: "views > 300% MA & low stock",
              tone: "warning",
            },
            { label: "Price updates / sec", value: `${stats.updatesPerSec}`, sub: "streaming cadence" },
            {
              label: "p95 inference",
              value: `${stats.p95.toFixed(2)} ms`,
              sub: "target < 50 ms",
              tone: "success",
            },
          ]}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by SKU id or product…"
          className="h-9 w-64 bg-card"
        />
        <span className="label-xs ml-2">Category freeze</span>
        {CATEGORIES.map((c) => {
          const on = frozenCats.has(c);
          return (
            <Badge
              key={c}
              variant="outline"
              onClick={() =>
                setFrozenCats((prev) => {
                  const next = new Set(prev);
                  if (next.has(c)) next.delete(c);
                  else next.add(c);
                  return next;
                })
              }
              className={
                on
                  ? "cursor-pointer border-destructive/50 bg-destructive/15 text-destructive"
                  : "cursor-pointer border-border text-muted-foreground hover:bg-secondary"
              }
            >
              {c}
            </Badge>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <SkuTable
          rows={rows.slice(0, 60)}
          selected={activeId}
          onSelect={setSelected}
          frozen={frozenSkus}
          onToggleFreeze={(id) =>
            setFrozenSkus((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />
        <div className="space-y-4">
          {activeRow ? (
            <>
              <SkuDetail sku={activeRow.sku} rec={activeRow.rec} now={FIXED_NOW} />
              <Simulator sku={activeRow.sku} now={FIXED_NOW} state={sim} onChange={setSim} />
            </>
          ) : null}
        </div>
      </div>

      <section className="panel mt-4 p-4">
        <p className="label-xs">Reference deployment</p>
        <h2 className="mt-1 text-sm font-semibold">Python service topology</h2>
        <pre className="num mt-3 overflow-auto rounded-md border border-border bg-secondary/40 p-4 text-xs leading-relaxed text-muted-foreground">
{`events ──▶ kafka (clicks | inventory | competitor)
              │
              ▼
      fastapi consumer ──▶ redis feature store
              │                  │
              ▼                  ▼
   elasticity + xgboost ──▶ rules engine ──▶ /api/v1/recommend-price
                              (flash sale · guardrails)   < 50 ms`}
        </pre>
        <p className="mt-3 text-xs text-muted-foreground">
          The downloadable Python codebase mirrors this dashboard exactly: config/settings.py,
          data_pipeline/, models/, api/main.py, dashboard/app.py and docker-compose.yml.
        </p>
      </section>
    </main>
  );
}
