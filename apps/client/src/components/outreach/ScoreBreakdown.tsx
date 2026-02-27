import type { RankedPath } from "@warmpath/shared/contracts/warm-path";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ScoreBreakdownProps {
  path: RankedPath | null;
}

const dimensions: {
  key: keyof Pick<RankedPath, "company_affinity" | "role_relevance" | "relationship_strength" | "shared_context" | "confidence">;
  label: string;
  barClass: string;
  dotClass: string;
}[] = [
  { key: "company_affinity", label: "Company Match", barClass: "bg-[oklch(0.62_0.15_50)]", dotClass: "bg-[oklch(0.62_0.15_50)]" },
  { key: "role_relevance", label: "Role Fit", barClass: "bg-[oklch(0.65_0.13_160)]", dotClass: "bg-[oklch(0.65_0.13_160)]" },
  { key: "relationship_strength", label: "Relationship Strength", barClass: "bg-[oklch(0.58_0.16_300)]", dotClass: "bg-[oklch(0.58_0.16_300)]" },
  { key: "shared_context", label: "Shared Context", barClass: "bg-[oklch(0.72_0.14_70)]", dotClass: "bg-[oklch(0.72_0.14_70)]" },
  { key: "confidence", label: "Data Confidence", barClass: "bg-[oklch(0.62_0.14_20)]", dotClass: "bg-[oklch(0.62_0.14_20)]" },
];

export function ScoreBreakdown(props: ScoreBreakdownProps) {
  if (!props.path) {
    return (
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Score Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a ranked path to view score details.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in-up overflow-hidden">
      <CardHeader className="border-b border-border/50 bg-accent/30">
        <CardTitle>Score Breakdown &mdash; {props.path.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {dimensions.map((dim, index) => {
          const value = props.path![dim.key];
          const pct = Math.round(value * 10);
          return (
            <div
              key={dim.key}
              className={cn("space-y-1.5", `stagger-${index + 1}`)}
            >
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={cn("size-2 rounded-full", dim.dotClass)} />
                  <span className="font-medium">{dim.label}</span>
                </div>
                <span className="font-mono font-bold">{value}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all duration-700 ease-out", dim.barClass)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
