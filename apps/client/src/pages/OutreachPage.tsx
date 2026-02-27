import { useEffect, useState } from "react";
import { JobPicker } from "../components/outreach/JobPicker";
import { ContactsImportPanel } from "../components/outreach/ContactsImportPanel";
import { ScoutPanel } from "../components/outreach/ScoutPanel";
import { SettingsPanel } from "../components/outreach/SettingsPanel";
import { BuildPathPanel, type BuildPathCandidate } from "../components/outreach/BuildPathPanel";
import { RankedPathsList } from "../components/outreach/RankedPathsList";
import { IntroDraftPanel } from "../components/outreach/IntroDraftPanel";
import { AppLayout } from "../components/layout/AppLayout";
import type { WorkflowStep } from "../components/layout/AppSidebar";
import {
  autoTuneLearning,
  generateDistributionPack,
  getWarmPathSettings,
  getLearningSummary,
  generateMessagePack,
  generateOutreachBrief,
  draftIntro,
  getWorkflowSnapshot,
  getScoutStats,
  getScoutRun,
  importContactsFromCsv,
  listContacts,
  listJobs,
  listScoutRuns,
  rankWarmPaths,
  recordLearningFeedback,
  runSecondDegreeScout,
  scheduleReminder,
  syncJobs,
  trackWorkflowStatus,
  updateWarmPathSettings,
  updateReminder,
} from "../lib/api";
import type { NormalizedJob } from "@warmpath/shared/contracts/job";
import type {
  ScoutRunDiagnostics,
  ScoutRunStats,
  SecondDegreeScoutRequest,
  SecondDegreeScoutRun,
} from "@warmpath/shared/contracts/scout";
import type {
  DistributionPackResponse,
  IntroDraftResponse,
  LearningSummaryResponse,
  MessageChannel,
  MessagePackResponse,
  OutreachWorkflowStatus,
  OutreachBriefResponse,
  RankedPath,
  WarmPathSettings,
  WarmPathSettingsResponse,
  WorkflowSnapshotResponse,
} from "@warmpath/shared/contracts/warm-path";

export function OutreachPage() {
  const [activeStep, setActiveStep] = useState<WorkflowStep>("settings");
  const [jobs, setJobs] = useState<NormalizedJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [paths, setPaths] = useState<RankedPath[]>([]);
  const [selectedColleagueId, setSelectedColleagueId] = useState<string | null>(null);
  const [brief, setBrief] = useState<OutreachBriefResponse | null>(null);
  const [messagePack, setMessagePack] = useState<MessagePackResponse | null>(null);
  const [distributionPack, setDistributionPack] = useState<DistributionPackResponse | null>(null);
  const [draft, setDraft] = useState<IntroDraftResponse | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [contactCount, setContactCount] = useState(0);
  const [scoutRuns, setScoutRuns] = useState<SecondDegreeScoutRun[]>([]);
  const [selectedScoutRun, setSelectedScoutRun] = useState<SecondDegreeScoutRun | null>(null);
  const [scoutStats, setScoutStats] = useState<ScoutRunStats | null>(null);
  const [scoutNotes, setScoutNotes] = useState<string | null>(null);
  const [scoutDiagnostics, setScoutDiagnostics] = useState<ScoutRunDiagnostics | null>(null);
  const [pendingBuildPathCandidate, setPendingBuildPathCandidate] = useState<BuildPathCandidate | null>(null);
  const [buildPathHint, setBuildPathHint] = useState<string | null>(null);
  const [draftExtraContext, setDraftExtraContext] = useState("");
  const [draftContextHint, setDraftContextHint] = useState<string | null>(null);
  const [draftContextSource, setDraftContextSource] = useState<"build_path" | null>(null);
  const [draftAppliedContext, setDraftAppliedContext] = useState<string | null>(null);
  const [draftAppliedContextSource, setDraftAppliedContextSource] = useState<"build_path" | "manual" | null>(null);
  const [workflowSnapshot, setWorkflowSnapshot] = useState<WorkflowSnapshotResponse | null>(null);
  const [settings, setSettings] = useState<WarmPathSettingsResponse | null>(null);
  const [learningSummary, setLearningSummary] = useState<LearningSummaryResponse | null>(null);
  const [draftTone, setDraftTone] = useState<"warm" | "concise" | "direct">("warm");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImportingContacts, setIsImportingContacts] = useState(false);
  const [isScouting, setIsScouting] = useState(false);
  const [isRanking, setIsRanking] = useState(false);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [isGeneratingMessagePack, setIsGeneratingMessagePack] = useState(false);
  const [isGeneratingDistributionPack, setIsGeneratingDistributionPack] = useState(false);
  const [isUpdatingWorkflow, setIsUpdatingWorkflow] = useState(false);
  const [isUpdatingLearning, setIsUpdatingLearning] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshSettings();
    void refreshJobs();
    void refreshContacts();
    void refreshScoutRuns();
    void refreshScoutStats();
    void refreshLearningSummary();
  }, []);

  async function refreshSettings(): Promise<void> {
    try {
      const next = await getWarmPathSettings();
      setSettings(next);
      await refreshJobs(next.settings.advisor_slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function refreshJobs(advisorSlug: string = settings?.settings.advisor_slug ?? "hirefrank"): Promise<void> {
    try {
      const limit = settings?.settings.default_list_limit ?? 1000;
      const result = await listJobs({ advisor_slug: advisorSlug, limit });
      setJobs(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function refreshContacts(): Promise<void> {
    try {
      const contacts = await listContacts();
      setContactCount(contacts.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function refreshScoutRuns(): Promise<void> {
    try {
      const runs = await listScoutRuns(20);
      setScoutRuns(runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function refreshScoutStats(): Promise<void> {
    try {
      const stats = await getScoutStats();
      setScoutStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function refreshLearningSummary(): Promise<void> {
    try {
      const summary = await getLearningSummary();
      setLearningSummary(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSaveSettings(patch: Partial<WarmPathSettings>): Promise<void> {
    setError(null);
    setIsSavingSettings(true);
    try {
      const result = await updateWarmPathSettings(patch);
      setSettings(result);
      await refreshJobs(result.settings.advisor_slug);
      setActiveStep("scout");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleSync(): Promise<void> {
    setError(null);
    setIsSyncing(true);
    try {
      const advisorSlug = settings?.settings.advisor_slug ?? "hirefrank";
      const category = settings?.settings.default_job_category ?? "product";
      await syncJobs({ advisor_slug: advisorSlug, category, source: "network" });
      await refreshJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleRank(candidateOverride?: BuildPathCandidate): Promise<void> {
    if (!selectedJobId) return;
    setError(null);
    setIsRanking(true);
    try {
      const advisorSlug = settings?.settings.advisor_slug ?? "hirefrank";
      const result = await rankWarmPaths({
        advisor_slug: advisorSlug,
        job_cache_id: selectedJobId,
      });
      setRunId(result.run_id);
      setPaths(result.top_paths);
      const weightProfile = result.weight_profile;
      if (weightProfile) {
        setLearningSummary((current) => {
          if (!current) {
            return {
              active_profile: weightProfile,
              totals: {
                feedback_count: 0,
                successful_outcomes: 0,
                recent_feedback_count: 0,
              },
              recent_feedback: [],
            };
          }

          return {
            ...current,
            active_profile: weightProfile,
          };
        });
      }

      const activeBuildPathCandidate = candidateOverride ?? pendingBuildPathCandidate;
      const preferredContactId = activeBuildPathCandidate?.connectorContactId;
      let selectedId = result.top_paths[0]?.colleague_id ?? null;

      if (preferredContactId) {
        const matchedPath = result.top_paths.find((path) => path.colleague_id === preferredContactId);
        if (matchedPath) {
          selectedId = matchedPath.colleague_id;
          setBuildPathHint(
            `Build Path preselected ${matchedPath.name} for ${activeBuildPathCandidate?.fullName ?? "your candidate"}.`
          );
          setDraftContextHint(
            `Prefilled from Build Path candidate ${activeBuildPathCandidate?.fullName ?? "target"} via ${activeBuildPathCandidate?.connectorName ?? "connector"}.`
          );
          setDraftContextSource("build_path");
        } else {
          setBuildPathHint(
            `Build Path suggestion ${activeBuildPathCandidate?.connectorName ?? "connector"} was not present in ranked paths. Review top matches.`
          );
          setDraftContextHint(
            `Build Path context retained for ${activeBuildPathCandidate?.fullName ?? "selected candidate"}.`
          );
          setDraftContextSource("build_path");
        }
      } else if (activeBuildPathCandidate) {
        setBuildPathHint(
          `Build Path candidate ${activeBuildPathCandidate.fullName} has no linked contact id. Review ranked paths manually.`
        );
        setDraftContextHint(
          `Build Path context retained for ${activeBuildPathCandidate.fullName}.`
        );
        setDraftContextSource("build_path");
      }

      setSelectedColleagueId(selectedId);
      setPendingBuildPathCandidate(null);
      setBrief(null);
      setMessagePack(null);
      setDistributionPack(null);
      setDraft(null);
      setWorkflowSnapshot(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRanking(false);
    }
  }

  async function handleImportContacts(csv: string): Promise<void> {
    setError(null);
    setIsImportingContacts(true);
    try {
      await importContactsFromCsv(csv);
      await refreshContacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImportingContacts(false);
    }
  }

  async function handleRunScout(request: SecondDegreeScoutRequest): Promise<void> {
    setError(null);
    setScoutNotes(null);
    setIsScouting(true);
    try {
      const result = await runSecondDegreeScout(request);
      setSelectedScoutRun(result.run);
      setScoutNotes(result.notes ?? null);
      setScoutDiagnostics(result.diagnostics);
      await refreshScoutRuns();
      await refreshScoutStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsScouting(false);
    }
  }

  async function handleSelectScoutRun(runIdValue: string): Promise<void> {
    setError(null);
    try {
      const result = await getScoutRun(runIdValue);
      setSelectedScoutRun(result.run);
      setScoutDiagnostics(result.diagnostics ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDraft(): Promise<void> {
    if (!runId || !selectedColleagueId) return;
    setError(null);
    setIsDrafting(true);
    try {
      const trimmedContext = draftExtraContext.trim();
      const result = await draftIntro({
        run_id: runId,
        colleague_id: selectedColleagueId,
        extra_context: trimmedContext || undefined,
        tone: draftTone,
      });
      setDraft(result);
      setBrief(result.brief ?? null);
      setMessagePack(result.message_pack ?? null);
      setDistributionPack(null);
      const appliedContext = result.applied_context ?? (trimmedContext || null);
      setDraftAppliedContext(appliedContext);
      setDraftAppliedContextSource(appliedContext ? (draftContextSource ?? "manual") : null);
      const workflow = await getWorkflowSnapshot({ run_id: runId, colleague_id: selectedColleagueId });
      setWorkflowSnapshot(workflow);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDrafting(false);
    }
  }

  async function handleGenerateBrief(): Promise<void> {
    if (!runId || !selectedColleagueId) return;
    setError(null);
    setIsGeneratingBrief(true);
    try {
      const trimmedContext = draftExtraContext.trim();
      const result = await generateOutreachBrief({
        run_id: runId,
        colleague_id: selectedColleagueId,
        extra_context: trimmedContext || undefined,
        tone: draftTone,
      });
      setBrief(result);
      setMessagePack(null);
      setDistributionPack(null);
      setDraftAppliedContext(result.applied_context ?? (trimmedContext || null));
      setDraftAppliedContextSource(result.applied_context || trimmedContext ? (draftContextSource ?? "manual") : null);
      const workflow = await getWorkflowSnapshot({ run_id: runId, colleague_id: selectedColleagueId });
      setWorkflowSnapshot(workflow);
      setActiveStep("draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingBrief(false);
    }
  }

  async function handleGenerateMessagePack(): Promise<void> {
    if (!runId || !selectedColleagueId) return;
    setError(null);
    setIsGeneratingMessagePack(true);
    try {
      const trimmedContext = draftExtraContext.trim();
      const result = await generateMessagePack({
        run_id: runId,
        colleague_id: selectedColleagueId,
        extra_context: trimmedContext || undefined,
        tone: draftTone,
      });
      setMessagePack(result);
      setBrief(result.brief);
      setDistributionPack(null);
      setDraftAppliedContext(result.applied_context ?? (trimmedContext || null));
      setDraftAppliedContextSource(result.applied_context || trimmedContext ? (draftContextSource ?? "manual") : null);
      const workflow = await getWorkflowSnapshot({ run_id: runId, colleague_id: selectedColleagueId });
      setWorkflowSnapshot(workflow);
      setActiveStep("draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingMessagePack(false);
    }
  }

  async function handleGenerateDistributionPack(): Promise<void> {
    if (!runId || !selectedColleagueId) return;
    setError(null);
    setIsGeneratingDistributionPack(true);
    try {
      const trimmedContext = draftExtraContext.trim();
      const result = await generateDistributionPack({
        run_id: runId,
        colleague_id: selectedColleagueId,
        extra_context: trimmedContext || undefined,
        tone: draftTone,
      });
      setDistributionPack(result);
      const workflow = await getWorkflowSnapshot({ run_id: runId, colleague_id: selectedColleagueId });
      setWorkflowSnapshot(workflow);
      setActiveStep("draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingDistributionPack(false);
    }
  }

  async function handleTrackWorkflowStatus(
    status: OutreachWorkflowStatus,
    channel?: MessageChannel
  ): Promise<void> {
    if (!runId || !selectedColleagueId) return;
    setError(null);
    setIsUpdatingWorkflow(true);
    try {
      const result = await trackWorkflowStatus({
        run_id: runId,
        colleague_id: selectedColleagueId,
        status,
        channel,
      });
      setWorkflowSnapshot(result.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpdatingWorkflow(false);
    }
  }

  async function handleScheduleReminder(
    message: string,
    offsetDays: number,
    channel: MessageChannel
  ): Promise<void> {
    if (!runId || !selectedColleagueId) return;
    setError(null);
    setIsUpdatingWorkflow(true);
    try {
      const result = await scheduleReminder({
        run_id: runId,
        colleague_id: selectedColleagueId,
        message,
        offset_days: offsetDays,
        channel,
      });
      setWorkflowSnapshot(result.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpdatingWorkflow(false);
    }
  }

  async function handleUpdateReminder(
    reminderId: string,
    status: "pending" | "completed" | "cancelled"
  ): Promise<void> {
    if (!runId) return;
    setError(null);
    setIsUpdatingWorkflow(true);
    try {
      const result = await updateReminder({
        run_id: runId,
        reminder_id: reminderId,
        status,
      });
      setWorkflowSnapshot(result.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpdatingWorkflow(false);
    }
  }

  async function handleRecordLearning(outcome: "intro_accepted" | "replied" | "not_interested" | "no_response"): Promise<void> {
    if (!runId || !selectedColleagueId) return;
    setError(null);
    setIsUpdatingLearning(true);
    try {
      const result = await recordLearningFeedback({
        run_id: runId,
        colleague_id: selectedColleagueId,
        outcome,
      });
      setLearningSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpdatingLearning(false);
    }
  }

  async function handleAutoTuneLearning(): Promise<void> {
    setError(null);
    setIsUpdatingLearning(true);
    try {
      await autoTuneLearning(5);
      await refreshLearningSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpdatingLearning(false);
    }
  }

  function applyBuildPathCandidateContext(candidate: BuildPathCandidate): void {
    setPendingBuildPathCandidate(candidate);
    setDraftExtraContext(
      [
        `Build Path target: ${candidate.fullName} (${candidate.title} @ ${candidate.company}).`,
        `Preferred connector: ${candidate.connectorName}.`,
        `Suggested ask: ${candidate.recommendedAsk}.`,
        `Path score: ${candidate.pathScore}; connector strength: ${Math.round(candidate.connectorStrength * 100)}%; target confidence: ${Math.round(candidate.confidence * 100)}%.`,
      ].join(" ")
    );
    setDraftContextHint(
      `Prefilled from Build Path candidate ${candidate.fullName} with connector ${candidate.connectorName}.`
    );
    setDraftContextSource("build_path");
  }

  function handleUseBuildPathCandidate(candidate: BuildPathCandidate): void {
    applyBuildPathCandidateContext(candidate);

    if (!selectedJobId) {
      setBuildPathHint(
        `Build Path selected ${candidate.connectorName} -> ${candidate.fullName}. Pick a job next, then run Rank.`
      );
      setActiveStep("jobs");
      return;
    }

    setBuildPathHint(
      `Build Path selected ${candidate.connectorName} -> ${candidate.fullName}. Run Rank to apply this connector preference.`
    );
    setActiveStep("rank");
  }

  async function handleUseBuildPathCandidateAndRank(candidate: BuildPathCandidate): Promise<void> {
    applyBuildPathCandidateContext(candidate);

    if (!selectedJobId) {
      setBuildPathHint(
        `Build Path selected ${candidate.connectorName} -> ${candidate.fullName}. Pick a job next, then rank.`
      );
      setActiveStep("jobs");
      return;
    }

    setBuildPathHint(
      `Build Path selected ${candidate.connectorName} -> ${candidate.fullName}. Ranking now with this connector preference.`
    );
    setActiveStep("rank");
    await handleRank(candidate);
  }

  function handleOpenRankFromBuildPath(): void {
    if (!selectedJobId) {
      setBuildPathHint("Select a job before ranking Build Path candidates.");
      setActiveStep("jobs");
      return;
    }

    setActiveStep("rank");
  }

  function handleResetDraftContext(): void {
    setDraftExtraContext("");
    setDraftContextHint(null);
    setDraftContextSource(null);
  }

  return (
    <AppLayout
      activeStep={activeStep}
      onStepChange={setActiveStep}
      contactCount={contactCount}
      jobCount={jobs.length}
      buildPathCount={selectedScoutRun?.connector_paths.length ?? 0}
      pathCount={paths.length}
      hasDraft={draft !== null || brief !== null || messagePack !== null || distributionPack !== null}
      settingsReady={settings !== null}
    >
      {error ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive animate-fade-in-up" role="alert">
          <div className="mt-0.5 size-1.5 shrink-0 rounded-full bg-destructive" />
          {error}
        </div>
      ) : null}

      {buildPathHint ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground animate-fade-in-up">
          <div className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary" />
          {buildPathHint}
        </div>
      ) : null}

      {activeStep === "settings" && (
        <SettingsPanel
          settings={settings?.settings ?? null}
          hints={settings?.hints ?? null}
          isSaving={isSavingSettings}
          onSave={handleSaveSettings}
        />
      )}

      {activeStep === "scout" && (
        <ScoutPanel
          runs={scoutRuns}
          selectedRun={selectedScoutRun}
          stats={scoutStats}
          isRunning={isScouting}
          notes={scoutNotes}
          diagnostics={scoutDiagnostics}
          onRun={handleRunScout}
          onSelectRun={handleSelectScoutRun}
        />
      )}

      {activeStep === "import" && (
        <ContactsImportPanel
          contactCount={contactCount}
          isImporting={isImportingContacts}
          onImportCsv={handleImportContacts}
        />
      )}

      {activeStep === "jobs" && (
        <JobPicker
          jobs={jobs}
          selectedJobId={selectedJobId}
          isSyncing={isSyncing}
          isRanking={isRanking}
          onSync={handleSync}
          onSelectJob={setSelectedJobId}
          onRank={handleRank}
        />
      )}

      {activeStep === "buildPath" && (
        <BuildPathPanel
          runs={scoutRuns}
          selectedRun={selectedScoutRun}
          isRanking={isRanking}
          onSelectRun={handleSelectScoutRun}
          onOpenScoutStep={() => setActiveStep("scout")}
          onOpenRankStep={handleOpenRankFromBuildPath}
          onUseCandidate={handleUseBuildPathCandidate}
          onUseCandidateAndRank={handleUseBuildPathCandidateAndRank}
        />
      )}

      {activeStep === "rank" && (
        <RankedPathsList
          paths={paths}
          selectedColleagueId={selectedColleagueId}
          onSelectColleague={setSelectedColleagueId}
          draftContext={draftExtraContext}
          draftContextHint={draftContextHint}
          draftContextSource={draftContextSource}
          onDraftContextChange={(value) => {
            setDraftExtraContext(value);
            if (draftContextHint && value.trim().length === 0) {
              setDraftContextHint(null);
              setDraftContextSource(null);
            }
          }}
          onResetDraftContext={handleResetDraftContext}
          draftTone={draftTone}
          onDraftToneChange={setDraftTone}
          onGenerateBrief={handleGenerateBrief}
          isGeneratingBrief={isGeneratingBrief}
          onGenerateMessagePack={handleGenerateMessagePack}
          isGeneratingMessagePack={isGeneratingMessagePack}
          onGenerateDistributionPack={handleGenerateDistributionPack}
          isGeneratingDistributionPack={isGeneratingDistributionPack}
          onDraft={handleDraft}
          isDrafting={isDrafting}
        />
      )}

      {activeStep === "draft" && (
        <IntroDraftPanel
          draft={draft}
          brief={brief}
          messagePack={messagePack}
          distributionPack={distributionPack}
          workflow={workflowSnapshot}
          isUpdatingWorkflow={isUpdatingWorkflow}
          onTrackStatus={handleTrackWorkflowStatus}
          onScheduleReminder={handleScheduleReminder}
          onUpdateReminder={handleUpdateReminder}
          learningSummary={learningSummary}
          isUpdatingLearning={isUpdatingLearning}
          onRecordLearning={handleRecordLearning}
          onAutoTune={handleAutoTuneLearning}
          context={draftAppliedContext}
          contextSource={draftAppliedContextSource}
        />
      )}
    </AppLayout>
  );
}
