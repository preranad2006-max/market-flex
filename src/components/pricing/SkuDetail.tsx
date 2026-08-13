import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RULE_LABEL, revenueCurve, type PriceRecommendation, type Sku } from "@/lib/pricing/engine";

interface Props {
  sku: Sku;
  rec: PriceRecommendation;
  now: Date;
}

export function SkuDetail({ sku, rec, now }: Props) {
  const curve = revenueCurve(sku, now);

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-xs">Price comparator · {sku.skuId}</p>
          <h2 className="mt-1 text-lg font-semibold">{sku.name}</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 text-right">
          <div>
            <p className="label-xs">Our price</p>
            <p className="num text-lg font-semibold">${rec.currentPrice.toFixed(2)}</p>
          </div>
          <div>
            <p className="label-xs">Comp. min</p>
            <p className="num text-lg font-semibold text-muted-foreground">
              ${rec.minCompetitorPrice.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="label-xs">Optimal</p>
            <p className="num text-lg font-semibold text-primary">
              ${rec.recommendedPrice.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={curve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="price"
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
            />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={48} />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [value.toFixed(2), name]}
              labelFormatter={(l: number) => `Price $${Number(l).toFixed(2)}`}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue R(p)"
              stroke="var(--color-chart-1)"
              fill="url(#revFill)"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="demand"
              name="Demand Q(p)"
              stroke="var(--color-chart-2)"
              strokeWidth={2}
              dot={false}
            />
            <ReferenceLine
              x={curve.reduce((a, b) =>
                Math.abs(b.price - rec.recommendedPrice) < Math.abs(a.price - rec.recommendedPrice) ? b : a,
              ).price}
              stroke="var(--color-chart-1)"
              strokeDasharray="4 4"
              label={{ value: "optimal", fill: "var(--color-chart-1)", fontSize: 10, position: "top" }}
            />
            <ReferenceLine
              x={curve.reduce((a, b) =>
                Math.abs(b.price - rec.minCompetitorPrice) < Math.abs(a.price - rec.minCompetitorPrice) ? b : a,
              ).price}
              stroke="var(--color-chart-4)"
              strokeDasharray="2 4"
              label={{ value: "comp", fill: "var(--color-chart-4)", fontSize: 10, position: "top" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: "Applied rule", v: RULE_LABEL[rec.appliedRule] },
          { l: "Predicted demand", v: `${rec.predictedDemand.toFixed(1)} u/h` },
          { l: "Elasticity ε", v: rec.elasticity.toFixed(2) },
          { l: "Inference", v: `${rec.latencyMs.toFixed(2)} ms` },
          { l: "Stock ratio", v: rec.features.stockRatio.toFixed(2) },
          { l: "Comp ratio", v: rec.features.compPriceRatio.toFixed(2) },
          { l: "Conv. 1h", v: `${(rec.features.conversionRate1h * 100).toFixed(2)}%` },
          { l: "Seasonal idx", v: rec.features.seasonalIndex.toFixed(2) },
        ].map((f) => (
          <div key={f.l} className="rounded-md border border-border bg-secondary/40 px-3 py-2">
            <p className="label-xs">{f.l}</p>
            <p className="num mt-0.5 text-sm font-medium">{f.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
