import { useState } from "react";
import type {
  DistributionPackResponse,
  IntroDraftResponse,
  LearningSummaryResponse,
  MessageChannel,
  MessagePackResponse,
  OutreachWorkflowStatus,
  OutreachBriefResponse,
  WorkflowSnapshotResponse,
} from "@warmpath/shared/contracts/warm-path";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Copy, Check, FileText, Mail, MessageSquare,
  Clock, Bell, BrainCircuit, GitBranch,
  Send, ChevronRight, AlertTriangle,
} from "lucide-react";

interface IntroDraftPanelProps {
  draft: IntroDraftResponse | null;
  brief: OutreachBriefResponse | null;
  messagePack: MessagePackResponse | null;
  distributionPack: DistributionPackResponse | null;
  workflow: WorkflowSnapshotResponse | null;
  isUpdatingWorkflow: boolean;
  onTrackStatus: (status: OutreachWorkflowStatus, channel?: MessageChannel) => Promise<void>;
  onScheduleReminder: (message: string, offsetDays: number, channel: MessageChannel) => Promise<void>;
  onUpdateReminder: (reminderId: string, status: "pending" | "completed" | "cancelled") => Promise<void>;
  learningSummary: LearningSummaryResponse | null;
  isUpdatingLearning: boolean;
  onRecordLearning: (outcome: "intro_accepted" | "replied" | "not_interested" | "no_response") => Promise<void>;
  onAutoTune: () => Promise<void>;
  context?: string | null;
  contextSource?: "build_path" | "manual" | null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => void handleCopy()} className="h-7 gap-1.5 px-2 text-xs">
      {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function SectionHeader(props: { icon: typeof FileText; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <props.icon className="size-3.5" />
        {props.title}
      </h3>
      {props.children}
    </div>
  );
}

export function IntroDraftPanel(props: IntroDraftPanelProps) {
  const [reminderMessage, setReminderMessage] = useState("Friendly follow-up on my earlier outreach.");
  const [reminderOffsetDays, setReminderOffsetDays] = useState("3");
  const [reminderChannel, setReminderChannel] = useState<MessageChannel>("email");

  if (!props.draft && !props.brief && !props.messagePack && !props.distributionPack) {
    return (
      <Card className="animate-fade-in-up overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-accent/30">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle>Outreach Pack</CardTitle>
              <CardDescription>
                Generate a structured outreach brief, then a forwardable intro email, DM, and follow-up cadence.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in-up overflow-hidden">
      <CardHeader className="border-b border-border/50 bg-accent/30">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="size-4 text-primary" />
          </div>
          <div>
            <CardTitle>Outreach Pack</CardTitle>
            <CardDescription>{props.draft?.subject ?? "Structured outreach brief"}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Structured Brief */}
        {props.brief ? (
          <div className="space-y-3 rounded-lg border bg-accent/20 p-4 animate-fade-in-up">
            <SectionHeader icon={FileText} title="Structured Brief">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">Ask: {props.brief.ask_type}</Badge>
                <Badge variant="outline" className="text-[10px]">Tone: {props.brief.tone}</Badge>
              </div>
            </SectionHeader>

            <div className="space-y-2 text-sm">
              <p><span className="font-semibold text-foreground/80">Objective:</span> {props.brief.objective}</p>
              <p><span className="font-semibold text-foreground/80">Reason:</span> {props.brief.reason_to_reach_out}</p>
              <p>
                <span className="font-semibold text-foreground/80">Connector:</span>{" "}
                {props.brief.connector.name}
                <span className="ml-1 font-mono text-xs text-muted-foreground">(score {props.brief.connector.total_score})</span>
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence</p>
                {props.brief.evidence.map((item) => (
                  <p key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="mt-0.5 size-1 shrink-0 rounded-full bg-primary/40" />
                    {item}
                  </p>
                ))}
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Talking Points</p>
                {props.brief.talking_points.map((item) => (
                  <p key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="mt-0.5 size-1 shrink-0 rounded-full bg-primary/40" />
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Message Pack */}
        {props.messagePack ? (
          <div className="space-y-3 rounded-lg border bg-accent/20 p-4 animate-fade-in-up stagger-1">
            <SectionHeader icon={MessageSquare} title="Message Variants" />
            <div className="space-y-3">
              {props.messagePack.message_variants.map((variant) => (
                <div key={variant.id} className="space-y-2 rounded-lg bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        "border text-[10px]",
                        variant.channel === "email"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-[oklch(0.58_0.16_300_/_0.1)] text-[oklch(0.48_0.16_300)] border-[oklch(0.58_0.16_300_/_0.2)]",
                      )}>
                        {variant.channel === "email" ? <Mail className="mr-1 size-2.5" /> : <MessageSquare className="mr-1 size-2.5" />}
                        {variant.channel}
                      </Badge>
                      <p className="text-sm font-medium">{variant.label}</p>
                    </div>
                    <CopyButton text={variant.subject ? `Subject: ${variant.subject}\n\n${variant.body}` : variant.body} />
                  </div>
                  {variant.subject ? (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Subject:</span> {variant.subject}
                    </p>
                  ) : null}
                  <div className="whitespace-pre-wrap rounded-lg bg-accent/40 p-3 font-mono text-[13px] leading-relaxed">
                    {variant.body}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 pt-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Follow-up Plan</p>
              {props.messagePack.follow_up_plan.map((step) => (
                <div key={`${step.day}-${step.channel}`} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="h-5 w-14 justify-center text-[10px]">Day {step.day}</Badge>
                  <Badge variant="outline" className="text-[10px]">{step.channel}</Badge>
                  <span>{step.guidance}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Distribution Pack */}
        {props.distributionPack ? (
          <div className="space-y-3 rounded-lg border bg-accent/20 p-4 animate-fade-in-up stagger-2">
            <SectionHeader icon={Send} title="Distribution Modes">
              <span className="text-[10px] text-muted-foreground">
                {new Date(props.distributionPack.generated_at).toLocaleString()}
              </span>
            </SectionHeader>
            {props.distributionPack.artifacts.map((artifact) => (
              <div key={artifact.mode} className="space-y-2 rounded-lg bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{artifact.mode}</Badge>
                    <p className="text-sm font-medium">{artifact.title}</p>
                  </div>
                  <CopyButton text={artifact.body} />
                </div>
                <p className="text-[10px] text-muted-foreground">{artifact.content_type}</p>
                <div className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-accent/40 p-3 font-mono text-xs leading-relaxed">
                  {artifact.body}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Workflow Tracking */}
        <div className="space-y-4 rounded-lg border bg-accent/20 p-4 animate-fade-in-up stagger-3">
          <SectionHeader icon={Clock} title="Workflow Tracking">
            {props.workflow?.latest_status ? (
              <Badge variant="secondary" className="text-[10px]">{props.workflow.latest_status}</Badge>
            ) : null}
          </SectionHeader>
          <p className="text-xs text-muted-foreground">
            Track where you are in the outreach process.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={props.isUpdatingWorkflow} onClick={() => void props.onTrackStatus("sent", "email")} className="gap-1 text-xs">
              <Send className="size-3" /> Mark Sent
            </Button>
            <Button size="sm" variant="outline" disabled={props.isUpdatingWorkflow} onClick={() => void props.onTrackStatus("follow_up_sent", "email")} className="text-xs">
              Follow-up Sent
            </Button>
            <Button size="sm" variant="outline" disabled={props.isUpdatingWorkflow} onClick={() => void props.onTrackStatus("replied")} className="text-xs">
              Replied
            </Button>
            <Button size="sm" variant="outline" disabled={props.isUpdatingWorkflow} onClick={() => void props.onTrackStatus("intro_accepted")} className="text-xs">
              Intro Accepted
            </Button>
          </div>

          {/* Reminder scheduler */}
          <div className="space-y-2 rounded-lg bg-card p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Bell className="size-3" />
              Schedule Reminder
            </p>
            <Input
              value={reminderMessage}
              onChange={(event) => setReminderMessage(event.currentTarget.value)}
              placeholder="Reminder message"
              className="text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                min={0}
                className="w-20 text-sm"
                value={reminderOffsetDays}
                onChange={(event) => setReminderOffsetDays(event.currentTarget.value)}
              />
              <span className="text-xs text-muted-foreground">days from now</span>
              <Button
                size="sm"
                variant="secondary"
                disabled={props.isUpdatingWorkflow || reminderMessage.trim().length === 0}
                onClick={() => {
                  const offset = Number(reminderOffsetDays);
                  if (!Number.isFinite(offset) || offset < 0) {
                    return;
                  }
                  void props.onScheduleReminder(reminderMessage.trim(), offset, reminderChannel);
                }}
                className="gap-1 text-xs"
              >
                <Clock className="size-3" />
                Schedule ({reminderChannel})
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={props.isUpdatingWorkflow}
                onClick={() => setReminderChannel((current) => current === "email" ? "dm" : "email")}
                className="text-xs"
              >
                {reminderChannel === "email" ? <Mail className="mr-1 size-3" /> : <MessageSquare className="mr-1 size-3" />}
                Toggle
              </Button>
            </div>
          </div>

          {/* Timeline */}
          {props.workflow?.timeline.length ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Timeline</p>
              {props.workflow.timeline.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 text-xs">
                  <span className="w-32 shrink-0 font-mono text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{entry.status}</Badge>
                  {entry.channel ? <Badge variant="secondary" className="text-[10px]">{entry.channel}</Badge> : null}
                  {entry.note ? <span className="text-muted-foreground">{entry.note}</span> : null}
                </div>
              ))}
            </div>
          ) : null}

          {/* Reminders */}
          {props.workflow?.reminders.length ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reminders</p>
              {props.workflow.reminders.map((reminder) => (
                <div key={reminder.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-card p-2.5 text-xs">
                  <Badge variant="outline" className="text-[10px]">{reminder.channel}</Badge>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px]",
                      reminder.status === "completed" && "bg-primary/10 text-primary",
                    )}
                  >
                    {reminder.status}
                  </Badge>
                  <span className="font-mono text-muted-foreground">{new Date(reminder.due_at).toLocaleDateString()}</span>
                  <span className="flex-1">{reminder.message}</span>
                  {reminder.status !== "completed" ? (
                    <Button size="sm" variant="ghost" disabled={props.isUpdatingWorkflow} onClick={() => void props.onUpdateReminder(reminder.id, "completed")} className="h-6 px-2 text-[10px]">
                      <Check className="mr-1 size-2.5" /> Complete
                    </Button>
                  ) : null}
                  {reminder.status !== "cancelled" ? (
                    <Button size="sm" variant="ghost" disabled={props.isUpdatingWorkflow} onClick={() => void props.onUpdateReminder(reminder.id, "cancelled")} className="h-6 px-2 text-[10px] text-muted-foreground">
                      Cancel
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Record Outcome */}
        <div className="space-y-3 rounded-lg border bg-accent/20 p-4 animate-fade-in-up stagger-4">
          <SectionHeader icon={BrainCircuit} title="Record Outcome">
            {props.learningSummary?.active_profile ? (
              <Badge variant="outline" className="text-[10px]">{props.learningSummary.active_profile.source}</Badge>
            ) : null}
          </SectionHeader>
          <p className="text-xs text-muted-foreground">
            After you reach out, record what happened so WarmPath can improve future recommendations.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={props.isUpdatingLearning} onClick={() => void props.onRecordLearning("intro_accepted")} className="text-xs">
              Intro Accepted
            </Button>
            <Button size="sm" variant="outline" disabled={props.isUpdatingLearning} onClick={() => void props.onRecordLearning("replied")} className="text-xs">
              Replied
            </Button>
            <Button size="sm" variant="outline" disabled={props.isUpdatingLearning} onClick={() => void props.onRecordLearning("no_response")} className="text-xs">
              No Response
            </Button>
            <Button size="sm" variant="outline" disabled={props.isUpdatingLearning} onClick={() => void props.onRecordLearning("not_interested")} className="text-xs">
              Not Interested
            </Button>
          </div>
          <Button size="sm" disabled={props.isUpdatingLearning} onClick={() => void props.onAutoTune()} className="gap-1.5 text-xs">
            <BrainCircuit className="size-3" />
            Improve Recommendations
          </Button>
          {props.learningSummary ? (
            <div className="flex flex-wrap gap-2 rounded-lg bg-card p-3">
              <div className="w-full text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {props.learningSummary.active_profile.label} &middot; {props.learningSummary.active_profile.sample_size} samples
              </div>
              {(["company_affinity", "role_relevance", "relationship_strength", "shared_context", "confidence"] as const).map((key) => {
                const labels: Record<string, string> = {
                  company_affinity: "Company Match",
                  role_relevance: "Role Fit",
                  relationship_strength: "Relationship",
                  shared_context: "Shared Context",
                  confidence: "Confidence",
                };
                return (
                  <div key={key} className="flex items-center gap-1 rounded bg-accent/50 px-2 py-1">
                    <span className="text-[10px] text-muted-foreground">{labels[key]}</span>
                    <span className="font-mono text-xs font-bold">{props.learningSummary!.active_profile.weights[key]}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Context Timeline */}
        <div className="space-y-2 rounded-lg border bg-accent/20 p-4 animate-fade-in-up stagger-5">
          <SectionHeader icon={GitBranch} title="Context Timeline">
            {props.contextSource ? (
              <Badge variant="outline" className="text-[10px]">
                {props.contextSource === "build_path" ? "Build Path" : "Manual"}
              </Badge>
            ) : null}
          </SectionHeader>
          <p className="text-xs text-muted-foreground">
            {props.context
              ? "This context was included in the draft request."
              : "No extra context was included for this draft."}
          </p>
          {props.context ? (
            <div className="whitespace-pre-wrap rounded-lg bg-card p-3 text-sm leading-relaxed">
              {props.context}
            </div>
          ) : null}

          {(props.draft?.safety_warnings ?? props.brief?.safety_warnings) && (props.draft?.safety_warnings ?? props.brief?.safety_warnings)?.length ? (
            <div className="space-y-1">
              {(props.draft?.safety_warnings ?? props.brief?.safety_warnings ?? []).map((warning) => (
                <p key={warning} className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        {/* Forwardable Email */}
        {props.draft ? (
          <>
            <Separator />
            <div className="space-y-3 animate-fade-in-up">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                  <Mail className="size-4 text-primary" />
                  Forwardable Email
                </h3>
                <CopyButton text={props.draft.forwardable_email} />
              </div>
              <div className="whitespace-pre-wrap rounded-lg border bg-card p-5 font-mono text-[13px] leading-relaxed shadow-sm">
                {props.draft.forwardable_email}
              </div>
            </div>

            <Separator />

            <div className="space-y-3 animate-fade-in-up stagger-1">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                  <MessageSquare className="size-4 text-primary" />
                  Short DM
                </h3>
                <CopyButton text={props.draft.short_dm} />
              </div>
              <div className="whitespace-pre-wrap rounded-lg border bg-card p-5 font-mono text-[13px] leading-relaxed shadow-sm">
                {props.draft.short_dm}
              </div>
            </div>

            <Separator />

            <div className="space-y-3 animate-fade-in-up stagger-2">
              <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                <ChevronRight className="size-4 text-primary" />
                Follow-up Sequence
              </h3>
              <div className="space-y-2">
                {props.draft.follow_up_sequence.map((step, index) => (
                  <div key={index} className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm shadow-sm">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                    <span className="whitespace-pre-wrap leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
