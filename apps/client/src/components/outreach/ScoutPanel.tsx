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
import { cn } from "@/lib/utils";
import { Search, ChevronRight, ChevronDown, Zap, AlertTriangle } from "lucide-react";

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
  const [showDiagnostics, setShowDiagnostics] = useState(false);

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
      <Card className="animate-fade-in-up overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-accent/30">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Search className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle>Scout Your Network</CardTitle>
              <CardDescription>
                Find people at your target company who are connected to someone you know.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="space-y-2">
            <Label htmlFor="target-company">Target company</Label>
            <Input
              id="target-company"
              value={targetCompany}
              onChange={(event) => setTargetCompany(event.currentTarget.value)}
              placeholder="e.g. Stripe"
              className="font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target-function">Department (optional)</Label>
              <Input
                id="target-function"
                value={targetFunction}
                onChange={(event) => setTargetFunction(event.currentTarget.value)}
                placeholder="product"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-title">Title (optional)</Label>
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
            className="gap-2"
          >
            {props.isRunning ? (
              <>
                <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Running scout...
              </>
            ) : (
              <>
                <Search className="size-4" />
                Run Scout
              </>
            )}
          </Button>

          {props.notes ? (
            <p className="text-sm text-muted-foreground">{props.notes}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up stagger-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Scout Runs</CardTitle>
            {props.stats ? (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {props.stats.total} total
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {props.stats.by_status.completed ?? 0} completed
                </Badge>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {props.runs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
              <Search className="mx-auto mb-2 size-5 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No scout runs yet. Run your first scout above.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {props.runs.map((run, index) => (
                <button
                  key={run.id}
                  onClick={() => void props.onSelectRun(run.id)}
                  className={cn(
                    "group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-200",
                    props.selectedRun?.id === run.id
                      ? "bg-primary/8 ring-1 ring-primary/20"
                      : "hover:bg-accent/60",
                    `stagger-${Math.min(index + 1, 6)}`,
                  )}
                >
                  <div className="space-y-0.5">
                    <p className="font-medium">{run.target_company}</p>
                    {run.diagnostics_summary ? (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {run.diagnostics_summary.source} / {run.diagnostics_summary.adapter_count} adapters
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {renderDiagnosticsSummaryBadge(run)}
                    <Badge variant={run.status === "completed" ? "default" : "outline"} className="text-[10px]">
                      {run.status}
                    </Badge>
                    <ChevronRight className="size-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {props.selectedRun ? (
            <>
              <Separator className="my-5" />
              <div className="space-y-4 animate-fade-in-up">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display font-semibold">Run: {props.selectedRun.id.slice(0, 8)}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{props.selectedRun.status}</Badge>
                      <span className="text-xs text-muted-foreground">Source: {props.selectedRun.source}</span>
                    </div>
                  </div>
                </div>
                {props.selectedRun.notes ? (
                  <p className="text-sm text-muted-foreground">{props.selectedRun.notes}</p>
                ) : null}

                {runDiagnostics ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowDiagnostics(!showDiagnostics)}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown className={cn("size-3.5 transition-transform", showDiagnostics && "rotate-180")} />
                      {showDiagnostics ? "Hide details" : "Show details"}
                    </button>
                    {showDiagnostics && (
                      <div className="rounded-lg border bg-accent/30 p-4 animate-fade-in-up">
                        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <Zap className="size-3" />
                          Run Details
                        </h4>
                        <p className="mb-3 font-mono text-[10px] text-muted-foreground">
                          source={runDiagnostics.source} / limit={runDiagnostics.effective_limit} / min_conf={runDiagnostics.min_confidence}
                        </p>
                        <div className="space-y-1">
                          {runDiagnostics.adapter_attempts.map((attempt) => (
                            <div key={attempt.adapter} className="flex items-center justify-between rounded-md bg-card px-3 py-2 text-xs">
                              <span className="font-medium">{attempt.adapter}</span>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={attempt.status === "success" ? "default" : "outline"}
                                  className="text-[10px]"
                                >
                                  {attempt.status}
                                </Badge>
                                <span className="font-mono text-muted-foreground">{attempt.result_count} hits</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {props.selectedRun.targets.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Targets ({props.selectedRun.targets.length})
                    </h4>
                    <div className="space-y-1">
                      {props.selectedRun.targets.map((target) => (
                        <div key={target.id} className="rounded-lg bg-accent/40 px-3 py-2 text-sm">
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
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Connector Paths ({props.selectedRun.connector_paths.length})
                    </h4>
                    <div className="space-y-1">
                      {props.selectedRun.connector_paths.map((path) => (
                        <div key={path.id} className="flex items-center justify-between rounded-lg bg-accent/40 px-3 py-2 text-sm">
                          <span className="font-medium">{path.connector_name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono text-[10px]">{path.path_score}</Badge>
                            <Badge variant="outline" className="text-[10px]">{path.recommended_ask ?? "intro"}</Badge>
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

function renderDiagnosticsSummaryBadge(run: SecondDegreeScoutRun) {
  const summary = run.diagnostics_summary;
  if (!summary) {
    return null;
  }

  if (summary.error_count > 0) {
    return (
      <Badge variant="destructive" className="gap-1 text-[10px]">
        <AlertTriangle className="size-2.5" />
        {summary.error_count} errors
      </Badge>
    );
  }

  if (summary.success_count > 0) {
    return <Badge variant="secondary" className="text-[10px]">{summary.success_count} hits</Badge>;
  }

  if (summary.not_configured_count === summary.adapter_count && summary.adapter_count > 0) {
    return <Badge variant="outline" className="text-[10px]">Set up LinkedIn in Settings</Badge>;
  }

  return <Badge variant="outline" className="text-[10px]">no hits</Badge>;
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
