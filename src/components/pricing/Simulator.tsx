import { Slider } from "@/components/ui/slider";
import { RULE_LABEL, recommendPrice, type Sku } from "@/lib/pricing/engine";

export interface SimState {
  stockPct: number; // % of reorder point
  compDropPct: number; // competitor price drop %
  trafficMult: number; // traffic spike multiplier
}

interface Props {
  sku: Sku;
  now: Date;
  state: SimState;
  onChange: (s: SimState) => void;
}

export function applySim(sku: Sku, s: SimState): Sku {
  return {
    ...sku,
    stock: Math.round((s.stockPct / 100) * sku.reorderPoint),
    competitorPrices: sku.competitorPrices.map((c) => c * (1 - s.compDropPct / 100)),
    views1h: Math.round(sku.viewsMovingAvg * s.trafficMult),
    purchases1h: Math.round(sku.viewsMovingAvg * s.trafficMult * 0.03),
  };
}

export function Simulator({ sku, now, state, onChange }: Props) {
  const simulated = applySim(sku, state);
  const rec = recommendPrice(simulated, now);
  const delta = ((rec.recommendedPrice - sku.currentPrice) / sku.currentPrice) * 100;

  const rows: { label: string; value: number; min: number; max: number; step: number; fmt: string; key: keyof SimState }[] = [
    { label: "Inventory level", value: state.stockPct, min: 0, max: 300, step: 5, fmt: "% of reorder point", key: "stockPct" },
    { label: "Competitor price drop", value: state.compDropPct, min: 0, max: 40, step: 1, fmt: "% below current", key: "compDropPct" },
    { label: "Traffic spike", value: state.trafficMult, min: 0.2, max: 6, step: 0.1, fmt: "× moving average", key: "trafficMult" },
  ];

  return (
    <div className="panel p-4">
      <p className="label-xs">What-if simulator</p>
      <h2 className="mt-1 text-sm font-semibold">Engine reaction for {sku.skuId}</h2>

      <div className="mt-4 space-y-5">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm">{r.label}</span>
              <span className="num text-sm text-primary">
                {r.value}
                <span className="ml-1 text-xs text-muted-foreground">{r.fmt}</span>
              </span>
            </div>
            <Slider
              className="mt-2"
              value={[r.value]}
              min={r.min}
              max={r.max}
              step={r.step}
              onValueChange={([v]) => onChange({ ...state, [r.key]: v ?? r.value })}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-md border border-primary/30 bg-primary/10 px-4 py-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="label-xs">Simulated price</p>
            <p className="num text-2xl font-semibold text-primary">
              ${rec.recommendedPrice.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="num text-sm">
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}% vs live
            </p>
            <p className="text-xs text-muted-foreground">{RULE_LABEL[rec.appliedRule]}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Predicted demand {rec.predictedDemand.toFixed(1)} u/h · stock ratio{" "}
          {rec.features.stockRatio.toFixed(2)} · inference {rec.latencyMs.toFixed(2)} ms
        </p>
      </div>
    </div>
  );
}
