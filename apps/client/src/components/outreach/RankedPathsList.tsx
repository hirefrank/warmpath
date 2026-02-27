import { ScoreBreakdown } from "./ScoreBreakdown";
import type { RankedPath } from "@warmpath/shared/contracts/warm-path";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { BarChart3, FileText, Package, Send, RotateCcw, Sparkles } from "lucide-react";

interface RankedPathsListProps {
  paths: RankedPath[];
  selectedColleagueId: string | null;
  onSelectColleague: (colleagueId: string) => void;
  draftContext: string;
  draftContextHint: string | null;
  draftContextSource: "build_path" | null;
  onDraftContextChange: (value: string) => void;
  onResetDraftContext: () => void;
  draftTone: "warm" | "concise" | "direct";
  onDraftToneChange: (value: "warm" | "concise" | "direct") => void;
  onGenerateBrief: () => Promise<void>;
  isGeneratingBrief: boolean;
  onGenerateMessagePack: () => Promise<void>;
  isGeneratingMessagePack: boolean;
  onGenerateDistributionPack: () => Promise<void>;
  isGeneratingDistributionPack: boolean;
  onDraft: () => Promise<void>;
  isDrafting: boolean;
}

function scoreGrade(score: number): { label: string; className: string } {
  if (score >= 80) return { label: "Excellent", className: "bg-primary/15 text-primary border-primary/25" };
  if (score >= 60) return { label: "Strong", className: "bg-[oklch(0.72_0.14_70_/_0.15)] text-[oklch(0.50_0.10_70)] border-[oklch(0.72_0.14_70_/_0.25)]" };
  if (score >= 40) return { label: "Moderate", className: "bg-muted text-muted-foreground border-border" };
  return { label: "Weak", className: "bg-muted text-muted-foreground/60 border-border" };
}

function askBadgeClass(ask: string): string {
  switch (ask) {
    case "intro": return "bg-primary/10 text-primary border-primary/20";
    case "referral": return "bg-[oklch(0.65_0.13_160_/_0.1)] text-[oklch(0.55_0.13_160)] border-[oklch(0.65_0.13_160_/_0.2)]";
    case "context": return "bg-[oklch(0.72_0.14_70_/_0.15)] text-[oklch(0.50_0.10_70)] border-[oklch(0.72_0.14_70_/_0.25)]";
    default: return "";
  }
}

export function RankedPathsList(props: RankedPathsListProps) {
  const selectedPath = props.paths.find((item) => item.colleague_id === props.selectedColleagueId) ?? null;
  const anyLoading = props.isGeneratingBrief || props.isGeneratingMessagePack || props.isGeneratingDistributionPack || props.isDrafting;

  if (props.paths.length === 0) {
    return (
      <Card className="animate-fade-in-up overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-accent/30">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle>Ranked Paths</CardTitle>
              <CardDescription>
                Select a job and rank warm paths to see results here.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="animate-fade-in-up overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-accent/30">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle>Ranked Paths</CardTitle>
              <CardDescription>
                Top contacts with recommended ask type and rationale.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          {props.paths.map((path, index) => {
            const isSelected = path.colleague_id === props.selectedColleagueId;
            const grade = scoreGrade(path.total_score);
            return (
              <button
                key={path.colleague_id}
                onClick={() => props.onSelectColleague(path.colleague_id)}
                className={cn(
                  "group flex w-full items-start justify-between rounded-lg border p-4 text-left transition-all duration-200",
                  isSelected
                    ? "border-primary/30 bg-primary/5 shadow-sm shadow-primary/5"
                    : "hover:border-border hover:bg-accent/40",
                  `stagger-${Math.min(index + 1, 6)}`,
                )}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold">{path.name}</span>
                    {isSelected && (
                      <div className="size-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{path.rationale}</p>
                </div>
                <div className="ml-4 flex shrink-0 flex-col items-end gap-1.5">
                  <span className="font-mono text-xl font-bold text-foreground">{path.total_score}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge className={cn("border text-[10px]", grade.className)}>
                      {grade.label}
                    </Badge>
                    <Badge className={cn("border text-[10px]", askBadgeClass(path.recommended_ask))}>
                      {path.recommended_ask}
                    </Badge>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Draft context controls */}
          <div className="space-y-3 rounded-lg border bg-accent/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="draft-context" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Draft context
              </Label>
              <div className="flex items-center gap-2">
                {props.draftContextSource === "build_path" ? (
                  <Badge variant="outline" className="text-[10px]">
                    Source: Build Path
                  </Badge>
                ) : null}
                {props.draftContext.length > 0 ? (
                  <Button size="sm" variant="ghost" onClick={props.onResetDraftContext} className="h-6 gap-1 px-2 text-[10px]">
                    <RotateCcw className="size-2.5" />
                    Reset
                  </Button>
                ) : null}
              </div>
            </div>
            <Textarea
              id="draft-context"
              rows={3}
              placeholder="e.g. I'm especially interested in their ML platform team, and I've built similar systems at my current company."
              value={props.draftContext}
              onChange={(event) => props.onDraftContextChange(event.currentTarget.value)}
              className="text-sm"
            />
            {props.draftContextHint ? (
              <p className="text-[11px] text-muted-foreground">{props.draftContextHint}</p>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="draft-tone" className="text-xs">Outreach tone</Label>
              <Select
                id="draft-tone"
                value={props.draftTone}
                onChange={(event) => {
                  const nextTone = event.currentTarget.value;
                  if (nextTone === "warm" || nextTone === "concise" || nextTone === "direct") {
                    props.onDraftToneChange(nextTone);
                  }
                }}
              >
                <option value="warm">Warm &mdash; friendly and personal</option>
                <option value="concise">Concise &mdash; short and to the point</option>
                <option value="direct">Direct &mdash; professional and straightforward</option>
              </Select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => void props.onGenerateBrief()}
              disabled={anyLoading || !props.selectedColleagueId}
              className="gap-1.5"
            >
              <FileText className="size-3.5" />
              {props.isGeneratingBrief ? "Generating..." : "Brief"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void props.onGenerateMessagePack()}
              disabled={anyLoading || !props.selectedColleagueId}
              className="gap-1.5"
            >
              <Package className="size-3.5" />
              {props.isGeneratingMessagePack ? "Generating..." : "Message Pack"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void props.onGenerateDistributionPack()}
              disabled={anyLoading || !props.selectedColleagueId}
              className="gap-1.5"
            >
              <Send className="size-3.5" />
              {props.isGeneratingDistributionPack ? "Packaging..." : "Distribution Pack"}
            </Button>
            <Button
              onClick={() => void props.onDraft()}
              disabled={anyLoading || !props.selectedColleagueId}
              className="gap-1.5"
            >
              {props.isDrafting ? (
                <>
                  <div className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  Generate Draft
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ScoreBreakdown path={selectedPath} />
    </div>
  );
}
