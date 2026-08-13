import { cn } from "@/lib/utils";

export interface Metric {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "warning" | "accent";
}

const toneClass: Record<NonNullable<Metric["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  accent: "text-accent",
};

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {metrics.map((m) => (
        <div key={m.label} className="panel px-4 py-3">
          <p className="label-xs">{m.label}</p>
          <p className={cn("num mt-1.5 text-2xl font-semibold", toneClass[m.tone ?? "default"])}>
            {m.value}
          </p>
          {m.sub ? <p className="mt-0.5 text-xs text-muted-foreground">{m.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}
