import { useMemo, useState } from "react";
import type { SecondDegreeScoutRun } from "@warmpath/shared/contracts/scout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { GitBranch, ArrowLeft, ArrowRight, Zap, ChevronRight } from "lucide-react";

interface BuildPathPanelProps {
  runs: SecondDegreeScoutRun[];
  selectedRun: SecondDegreeScoutRun | null;
  isRanking: boolean;
  onSelectRun: (runId: string) => Promise<void>;
  onOpenScoutStep: () => void;
  onOpenRankStep: () => void;
  onUseCandidate: (candidate: BuildPathCandidate) => void;
  onUseCandidateAndRank: (candidate: BuildPathCandidate) => Promise<void>;
}

export interface BuildPathCandidate {
  targetId: string;
  fullName: string;
  title: string;
  company: string;
  confidence: number;
  connectorName: string;
  connectorContactId?: string;
  connectorStrength: number;
  recommendedAsk: "context" | "intro" | "referral";
  pathScore: number;
}

type AskFilter = "all" | "context" | "intro" | "referral";

function scoreColor(score: number): string {
  if (score >= 80) return "text-[oklch(0.55_0.18_35)]";
  if (score >= 60) return "text-[oklch(0.62_0.16_50)]";
  return "text-muted-foreground";
}

function askBadgeClass(ask: string): string {
  switch (ask) {
    case "intro": return "bg-primary/10 text-primary border-primary/20";
    case "referral": return "bg-[oklch(0.65_0.13_160_/_0.1)] text-[oklch(0.55_0.13_160)] border-[oklch(0.65_0.13_160_/_0.2)]";
    case "context": return "bg-[oklch(0.72_0.14_70_/_0.15)] text-[oklch(0.50_0.10_70)] border-[oklch(0.72_0.14_70_/_0.25)]";
    default: return "";
  }
}

export function BuildPathPanel(props: BuildPathPanelProps) {
  const [minScore, setMinScore] = useState(60);
  const [askFilter, setAskFilter] = useState<AskFilter>("all");
  const [minStrength, setMinStrength] = useState(0.5);

  const candidates = useMemo(() => buildCandidates(props.selectedRun), [props.selectedRun]);
  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      const askMatches = askFilter === "all" || candidate.recommendedAsk === askFilter;
      return askMatches && candidate.pathScore >= minScore && candidate.connectorStrength >= minStrength;
    });
  }, [askFilter, candidates, minScore, minStrength]);

  const averagePathScore = useMemo(() => {
    if (props.selectedRun?.connector_paths.length) {
      const total = props.selectedRun.connector_paths.reduce((sum, path) => sum + path.path_score, 0);
      return Math.round(total / props.selectedRun.connector_paths.length);
    }
    return 0;
  }, [props.selectedRun]);

  return (
    <div className="space-y-6">
      <Card className="animate-fade-in-up overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-accent/30">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <GitBranch className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle>Build a Path Lane</CardTitle>
              <CardDescription>
                Promote viable 2nd-degree targets into actionable outreach paths.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {props.runs.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="build-path-run">Scout run</Label>
              <Select
                id="build-path-run"
                value={props.selectedRun?.id ?? ""}
                onChange={(event) => {
                  const runId = event.currentTarget.value;
                  if (runId) {
                    void props.onSelectRun(runId);
                  }
                }}
              >
                <option value="" disabled>
                  Select a scout run
                </option>
                {props.runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.target_company} ({run.status})
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {!props.selectedRun ? (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
              <GitBranch className="mx-auto mb-2 size-5 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Run Scout first to populate Build a Path candidates.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Targets"
                value={String(props.selectedRun.targets.length)}
              />
              <MetricCard
                label="Connector paths"
                value={String(props.selectedRun.connector_paths.length)}
              />
              <MetricCard
                label="Avg path score"
                value={averagePathScore > 0 ? String(averagePathScore) : "-"}
                highlight={averagePathScore >= 70}
              />
            </div>
          )}

          {/* Filters */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="build-path-min-score">Min path score</Label>
              <Select
                id="build-path-min-score"
                value={String(minScore)}
                onChange={(event) => setMinScore(Number(event.currentTarget.value))}
              >
                <option value="0">0+</option>
                <option value="50">50+</option>
                <option value="60">60+</option>
                <option value="70">70+</option>
                <option value="80">80+</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="build-path-ask-filter">Ask type</Label>
              <Select
                id="build-path-ask-filter"
                value={askFilter}
                onChange={(event) => setAskFilter(event.currentTarget.value as AskFilter)}
              >
                <option value="all">All asks</option>
                <option value="context">Context</option>
                <option value="intro">Intro</option>
                <option value="referral">Referral</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="build-path-min-strength">Min connector strength</Label>
              <Select
                id="build-path-min-strength"
                value={String(minStrength)}
                onChange={(event) => setMinStrength(Number(event.currentTarget.value))}
              >
                <option value="0">Any</option>
                <option value="0.5">50%+</option>
                <option value="0.65">65%+</option>
                <option value="0.75">75%+</option>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-muted-foreground">
              {filteredCandidates.length} of {candidates.length} candidates
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={props.onOpenScoutStep} className="gap-1.5">
              <ArrowLeft className="size-3.5" />
              Back to Scout
            </Button>
            <Button onClick={props.onOpenRankStep} disabled={filteredCandidates.length === 0} className="gap-1.5">
              Continue to Rank
              <ArrowRight className="size-3.5" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => props.onUseCandidate(filteredCandidates[0]!)}
              disabled={filteredCandidates.length === 0}
              className="gap-1.5"
            >
              <Zap className="size-3.5" />
              Use Top Candidate
            </Button>
            <Button
              onClick={() => void props.onUseCandidateAndRank(filteredCandidates[0]!)}
              disabled={props.isRanking || filteredCandidates.length === 0}
              className="gap-1.5"
            >
              {props.isRanking ? (
                <>
                  <div className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Ranking...
                </>
              ) : (
                <>
                  <Zap className="size-3.5" />
                  Use + Rank Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up stagger-2">
        <CardHeader>
          <CardTitle>Path Candidates</CardTitle>
          <CardDescription>
            Top target + connector pairings from the selected scout run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCandidates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
              <GitBranch className="mx-auto mb-2 size-5 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No viable candidates yet. Run Scout with a target company.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCandidates.map((candidate, index) => (
                <div
                  key={candidate.targetId}
                  className={cn(
                    "group space-y-3 rounded-lg border p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-sm",
                    `stagger-${Math.min(index + 1, 6)}`,
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-display font-semibold">{candidate.fullName}</p>
                      <p className="text-sm text-muted-foreground">
                        {candidate.title} @ {candidate.company}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("font-mono text-lg font-bold", scoreColor(candidate.pathScore))}>
                        {candidate.pathScore}
                      </span>
                      <Badge className={cn("border text-[10px]", askBadgeClass(candidate.recommendedAsk))}>
                        {candidate.recommendedAsk}
                      </Badge>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-score-gradient transition-all duration-500"
                      style={{ width: `${Math.max(4, candidate.pathScore)}%` }}
                    />
                  </div>

                  <Separator />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        <span className="font-medium text-foreground/80">{candidate.connectorName}</span>
                        {" "}connector
                      </span>
                      <span className="text-border">|</span>
                      <span>
                        Strength{" "}
                        <span className="font-mono font-medium text-foreground/80">
                          {Math.round(candidate.connectorStrength * 100)}%
                        </span>
                      </span>
                      <span className="text-border">|</span>
                      <span>
                        Confidence{" "}
                        <span className="font-mono font-medium text-foreground/80">
                          {Math.round(candidate.confidence * 100)}%
                        </span>
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => props.onUseCandidate(candidate)} className="gap-1 text-xs">
                        Use path
                        <ChevronRight className="size-3" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void props.onUseCandidateAndRank(candidate)}
                        disabled={props.isRanking}
                        className="gap-1 text-xs"
                      >
                        {props.isRanking ? "Ranking..." : "Use + Rank"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildCandidates(run: SecondDegreeScoutRun | null): BuildPathCandidate[] {
  if (!run || run.targets.length === 0 || run.connector_paths.length === 0) {
    return [];
  }

  const bestPathByTargetId = new Map<string, SecondDegreeScoutRun["connector_paths"][number]>();
  for (const path of run.connector_paths) {
    const existing = bestPathByTargetId.get(path.target_id);
    if (!existing || path.path_score > existing.path_score) {
      bestPathByTargetId.set(path.target_id, path);
    }
  }

  const candidates: BuildPathCandidate[] = [];

  for (const target of run.targets) {
    const bestPath = bestPathByTargetId.get(target.id);
    if (!bestPath) {
      continue;
    }

    candidates.push({
      targetId: target.id,
      fullName: target.full_name,
      title: target.current_title ?? "Unknown title",
      company: target.current_company ?? "Unknown company",
      confidence: target.confidence,
      connectorName: bestPath.connector_name,
      connectorContactId: bestPath.connector_contact_id,
      connectorStrength: bestPath.connector_strength,
      recommendedAsk: bestPath.recommended_ask ?? "intro",
      pathScore: Math.round(bestPath.path_score),
    });
  }

  return candidates.sort((a, b) => b.pathScore - a.pathScore);
}

function MetricCard(props: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "rounded-lg border px-4 py-3 transition-colors",
      props.highlight ? "border-primary/20 bg-primary/5" : "bg-accent/30",
    )}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{props.label}</p>
      <p className={cn(
        "font-display text-2xl font-bold",
        props.highlight ? "text-primary" : "text-foreground",
      )}>
        {props.value}
      </p>
    </div>
  );
}
