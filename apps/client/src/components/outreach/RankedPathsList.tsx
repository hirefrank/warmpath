import { ScoreBreakdown } from "./ScoreBreakdown";
import type { RankedPath } from "@warmpath/shared/contracts/warm-path";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RankedPathsListProps {
  paths: RankedPath[];
  selectedColleagueId: string | null;
  onSelectColleague: (colleagueId: string) => void;
  onDraft: () => Promise<void>;
  isDrafting: boolean;
}

export function RankedPathsList(props: RankedPathsListProps) {
  const selectedPath = props.paths.find((item) => item.colleague_id === props.selectedColleagueId) ?? null;

  if (props.paths.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ranked Paths</CardTitle>
          <CardDescription>
            Select a job and rank warm paths to see results here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ranked Paths</CardTitle>
          <CardDescription>
            Top contacts with recommended ask type and rationale.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {props.paths.map((path) => {
            const isSelected = path.colleague_id === props.selectedColleagueId;
            return (
              <button
                key={path.colleague_id}
                onClick={() => props.onSelectColleague(path.colleague_id)}
                className={cn(
                  "flex w-full items-start justify-between rounded-lg border p-3 text-left transition-colors",
                  isSelected
                    ? "border-primary ring-2 ring-primary/20"
                    : "hover:bg-accent",
                )}
              >
                <div className="space-y-1">
                  <span className="font-medium">{path.name}</span>
                  <p className="text-sm text-muted-foreground">{path.rationale}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">{path.total_score}</Badge>
                  <Badge variant="outline">{path.recommended_ask}</Badge>
                </div>
              </button>
            );
          })}

          <div className="pt-2">
            <Button
              onClick={() => void props.onDraft()}
              disabled={props.isDrafting || !props.selectedColleagueId}
            >
              {props.isDrafting ? "Generating..." : "Generate Draft"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ScoreBreakdown path={selectedPath} />
    </div>
  );
}
