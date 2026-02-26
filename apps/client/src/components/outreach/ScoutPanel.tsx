import { useMemo, useState } from "react";
import type {
  ScoutRunDiagnostics,
  ScoutRunStats,
  ScoutSeedTarget,
  SecondDegreeScoutRequest,
  SecondDegreeScoutRun,
} from "@warmpath/shared/contracts/scout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ScoutPanelProps {
  runs: SecondDegreeScoutRun[];
  selectedRun: SecondDegreeScoutRun | null;
  stats: ScoutRunStats | null;
  diagnostics: ScoutRunDiagnostics | null;
  isRunning: boolean;
  notes: string | null;
  onRun: (request: SecondDegreeScoutRequest) => Promise<void>;
  onSelectRun: (runId: string) => Promise<void>;
}

export function ScoutPanel(props: ScoutPanelProps) {
  const [targetCompany, setTargetCompany] = useState("");
  const [targetFunction, setTargetFunction] = useState("");
  const [targetTitle, setTargetTitle] = useState("");
  const [seedLines, setSeedLines] = useState("");
  const [limit, setLimit] = useState(25);

  const parsedSeeds = useMemo(() => parseSeedLines(seedLines), [seedLines]);
  const runDiagnostics = useMemo(() => {
    if (!props.selectedRun || !props.diagnostics) {
      return null;
    }
    return props.diagnostics.run_id === props.selectedRun.id ? props.diagnostics : null;
  }, [props.selectedRun, props.diagnostics]);

  async function handleRun(): Promise<void> {
    const request: SecondDegreeScoutRequest = {
      target_company: targetCompany.trim(),
      target_function: targetFunction.trim() || undefined,
      target_title: targetTitle.trim() || undefined,
      limit,
      seed_targets: parsedSeeds.length > 0 ? parsedSeeds : undefined,
    };

    await props.onRun(request);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>2nd-Degree Scout</CardTitle>
          <CardDescription>
            Run a scout to find likely 2nd-degree targets and connector paths.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target-company">Target company</Label>
            <Input
              id="target-company"
              value={targetCompany}
              onChange={(event) => setTargetCompany(event.currentTarget.value)}
              placeholder="Acme"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target-function">Target function (optional)</Label>
              <Input
                id="target-function"
                value={targetFunction}
                onChange={(event) => setTargetFunction(event.currentTarget.value)}
                placeholder="product"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-title">Target title (optional)</Label>
              <Input
                id="target-title"
                value={targetTitle}
                onChange={(event) => setTargetTitle(event.currentTarget.value)}
                placeholder="Senior Product Manager"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="limit">Result limit</Label>
            <Input
              id="limit"
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(event) => setLimit(Number(event.currentTarget.value) || 25)}
              className="w-24"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="seeds">
              Seed targets (optional): one per line as Name | Title | Company | URL
            </Label>
            <Textarea
              id="seeds"
              rows={4}
              value={seedLines}
              onChange={(event) => setSeedLines(event.currentTarget.value)}
            />
          </div>

          <Button
            disabled={props.isRunning || targetCompany.trim().length === 0}
            onClick={() => void handleRun()}
          >
            {props.isRunning ? "Running scout..." : "Run Scout"}
          </Button>

          {props.notes ? (
            <p className="text-sm text-muted-foreground">{props.notes}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Recent Scout Runs
            {props.stats ? (
              <Badge variant="secondary">
                {props.stats.total} total / {props.stats.by_status.completed ?? 0} completed
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {props.runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scout runs yet.</p>
          ) : (
            <div className="space-y-1">
              {props.runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => void props.onSelectRun(run.id)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-medium">{run.target_company}</span>
                  <Badge variant={run.status === "completed" ? "default" : "outline"}>
                    {run.status}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {props.selectedRun ? (
            <>
              <Separator className="my-4" />
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Run: {props.selectedRun.id.slice(0, 8)}</h3>
                  <p className="text-sm text-muted-foreground">
                    Status: {props.selectedRun.status} | Source: {props.selectedRun.source}
                  </p>
                  {props.selectedRun.notes ? (
                    <p className="mt-1 text-sm">{props.selectedRun.notes}</p>
                  ) : null}
                </div>

                {runDiagnostics ? (
                  <div className="rounded-md border bg-muted/40 p-3">
                    <h4 className="mb-2 text-sm font-medium">Adapter diagnostics</h4>
                    <p className="text-xs text-muted-foreground">
                      source={runDiagnostics.source} | limit={runDiagnostics.effective_limit} | min_confidence={runDiagnostics.min_confidence}
                    </p>
                    <div className="mt-2 space-y-1">
                      {runDiagnostics.adapter_attempts.map((attempt) => (
                        <div key={attempt.adapter} className="flex items-center justify-between rounded-md bg-background px-2 py-1.5 text-xs">
                          <span className="font-medium">{attempt.adapter}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={attempt.status === "success" ? "default" : "outline"}>
                              {attempt.status}
                            </Badge>
                            <span className="text-muted-foreground">{attempt.result_count} hits</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {props.selectedRun.targets.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Targets</h4>
                    <div className="space-y-1">
                      {props.selectedRun.targets.map((target) => (
                        <div key={target.id} className="rounded-md bg-muted px-3 py-2 text-sm">
                          <span className="font-medium">{target.full_name}</span>
                          <span className="text-muted-foreground">
                            {" "}&mdash; {target.current_title ?? "N/A"} @ {target.current_company ?? "N/A"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {props.selectedRun.connector_paths.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Connector Paths</h4>
                    <div className="space-y-1">
                      {props.selectedRun.connector_paths.map((path) => (
                        <div key={path.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                          <span className="font-medium">{path.connector_name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{path.path_score}</Badge>
                            <Badge variant="outline">{path.recommended_ask ?? "intro"}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function parseSeedLines(seedLines: string): ScoutSeedTarget[] {
  return seedLines
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [full_name, current_title, current_company, linkedin_url] = line
        .split("|")
        .map((part) => part.trim());

      return {
        full_name,
        current_title: current_title || undefined,
        current_company: current_company || undefined,
        linkedin_url: linkedin_url || undefined,
      };
    })
    .filter((seed) => seed.full_name.length > 0);
}
