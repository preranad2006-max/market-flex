import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RULE_LABEL, type PriceRecommendation, type Sku } from "@/lib/pricing/engine";

interface Props {
  rows: { sku: Sku; rec: PriceRecommendation }[];
  selected: string;
  onSelect: (skuId: string) => void;
  frozen: Set<string>;
  onToggleFreeze: (skuId: string) => void;
}

function ruleTone(rule: PriceRecommendation["appliedRule"]) {
  switch (rule) {
    case "FLASH_SALE_SCARCITY":
      return "border-warning/40 bg-warning/10 text-warning";
    case "STOCKOUT_GUARD":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "CLEARANCE_PUSH":
      return "border-accent/40 bg-accent/10 text-accent";
    case "MANUAL_FREEZE":
      return "border-border bg-muted text-muted-foreground";
    default:
      return "border-success/40 bg-success/10 text-success";
  }
}

type Reason = "Elasticity" | "Clearance" | "Competitor" | "Floor" | "Frozen";

function reasonFor(rec: PriceRecommendation): { label: Reason; detail: string } {
  switch (rec.appliedRule) {
    case "MANUAL_FREEZE":
      return { label: "Frozen", detail: "manual hold" };
    case "MARGIN_FLOOR":
      return { label: "Floor", detail: "margin floor hit" };
    case "COMPETITIVE_CEILING":
      return { label: "Competitor", detail: "capped vs comp. min" };
    case "CLEARANCE_PUSH":
      return { label: "Clearance", detail: "overstock markdown" };
    case "FLASH_SALE_SCARCITY":
      return { label: "Competitor", detail: "scarcity premium" };
    case "STOCKOUT_GUARD":
      return { label: "Clearance", detail: "low stock guard" };
    default:
      return { label: "Elasticity", detail: `ε ${rec.elasticity.toFixed(2)} revenue peak` };
  }
}

function reasonTone(label: Reason) {
  switch (label) {
    case "Clearance":
      return "border-accent/40 bg-accent/10 text-accent";
    case "Competitor":
      return "border-warning/40 bg-warning/10 text-warning";
    case "Floor":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "Frozen":
      return "border-border bg-muted text-muted-foreground";
    default:
      return "border-primary/40 bg-primary/10 text-primary";
  }
}

export function SkuTable({ rows, selected, onSelect, frozen, onToggleFreeze }: Props) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Live price recommendations</h2>
        <span className="label-xs">{rows.length} of 50,000+ SKUs streaming</span>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border text-left">
              {["SKU", "Our price", "Comp. min", "Optimal", "Δ", "Stock", "ε", "Rule", "Reason", ""].map((h) => (
                <th key={h} className="label-xs px-4 py-2 font-normal whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ sku, rec }) => {
              const delta = ((rec.recommendedPrice - rec.currentPrice) / rec.currentPrice) * 100;
              const reason = reasonFor(rec);
              const isSel = selected === sku.skuId;
              return (
                <tr
                  key={sku.skuId}
                  onClick={() => onSelect(sku.skuId)}
                  className={cn(
                    "cursor-pointer border-b border-border/60 transition-colors hover:bg-secondary/60",
                    isSel && "bg-secondary",
                  )}
                >
                  <td className="px-4 py-2">
                    <div className="font-medium">{sku.name}</div>
                    <div className="num text-xs text-muted-foreground">
                      {sku.skuId} · {sku.category}
                    </div>
                  </td>
                  <td className="num px-4 py-2">${rec.currentPrice.toFixed(2)}</td>
                  <td className="num px-4 py-2 text-muted-foreground">
                    ${rec.minCompetitorPrice.toFixed(2)}
                  </td>
                  <td className="num px-4 py-2 font-semibold text-primary">
                    ${rec.recommendedPrice.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      "num px-4 py-2",
                      delta > 0.05 ? "text-success" : delta < -0.05 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)}%
                  </td>
                  <td className="num px-4 py-2 text-muted-foreground">
                    {sku.stock}/{sku.reorderPoint}
                  </td>
                  <td className="num px-4 py-2 text-muted-foreground">{rec.elasticity.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={cn("whitespace-nowrap", ruleTone(rec.appliedRule))}>
                      {RULE_LABEL[rec.appliedRule]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={cn("whitespace-nowrap", reasonTone(reason.label))}>
                      {reason.label}
                    </Badge>
                    <div className="mt-1 text-xs whitespace-nowrap text-muted-foreground">
                      {reason.detail}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFreeze(sku.skuId);
                      }}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs transition-colors",
                        frozen.has(sku.skuId)
                          ? "border-destructive/50 bg-destructive/15 text-destructive"
                          : "border-border text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {frozen.has(sku.skuId) ? "Frozen" : "Freeze"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
