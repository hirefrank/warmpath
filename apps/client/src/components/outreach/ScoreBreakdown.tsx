import type { RankedPath } from "@warmpath/shared/contracts/warm-path";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ScoreBreakdownProps {
  path: RankedPath | null;
}

const dimensions: { key: keyof Pick<RankedPath, "company_affinity" | "role_relevance" | "relationship_strength" | "shared_context" | "confidence">; label: string; color: string }[] = [
  { key: "company_affinity", label: "Company Affinity", color: "bg-blue-500" },
  { key: "role_relevance", label: "Role Relevance", color: "bg-emerald-500" },
  { key: "relationship_strength", label: "Relationship Strength", color: "bg-violet-500" },
  { key: "shared_context", label: "Shared Context", color: "bg-amber-500" },
  { key: "confidence", label: "Confidence", color: "bg-rose-500" },
];

export function ScoreBreakdown(props: ScoreBreakdownProps) {
  if (!props.path) {
    return (
      <Card>
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
    <Card>
      <CardHeader>
        <CardTitle>Score Breakdown &mdash; {props.path.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {dimensions.map((dim) => {
          const value = props.path![dim.key];
          const pct = Math.round(value * 10);
          return (
            <div key={dim.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{dim.label}</span>
                <span className="font-medium">{value}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${dim.color}`}
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
