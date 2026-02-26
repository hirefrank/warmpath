import { useEffect, useState } from "react";
import { JobPicker } from "../components/outreach/JobPicker";
import { ContactsImportPanel } from "../components/outreach/ContactsImportPanel";
import { ScoutPanel } from "../components/outreach/ScoutPanel";
import { RankedPathsList } from "../components/outreach/RankedPathsList";
import { IntroDraftPanel } from "../components/outreach/IntroDraftPanel";
import { AppLayout } from "../components/layout/AppLayout";
import type { WorkflowStep } from "../components/layout/AppSidebar";
import {
  draftIntro,
  getScoutStats,
  getScoutRun,
  importContactsFromCsv,
  listContacts,
  listJobs,
  listScoutRuns,
  rankWarmPaths,
  runSecondDegreeScout,
  syncJobs,
} from "../lib/api";
import type { NormalizedJob } from "@warmpath/shared/contracts/job";
import type {
  ScoutRunDiagnostics,
  ScoutRunStats,
  SecondDegreeScoutRequest,
  SecondDegreeScoutRun,
} from "@warmpath/shared/contracts/scout";
import type { IntroDraftResponse, RankedPath } from "@warmpath/shared/contracts/warm-path";

export function OutreachPage() {
  const [activeStep, setActiveStep] = useState<WorkflowStep>("scout");
  const [jobs, setJobs] = useState<NormalizedJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [paths, setPaths] = useState<RankedPath[]>([]);
  const [selectedColleagueId, setSelectedColleagueId] = useState<string | null>(null);
  const [draft, setDraft] = useState<IntroDraftResponse | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [contactCount, setContactCount] = useState(0);
  const [scoutRuns, setScoutRuns] = useState<SecondDegreeScoutRun[]>([]);
  const [selectedScoutRun, setSelectedScoutRun] = useState<SecondDegreeScoutRun | null>(null);
  const [scoutStats, setScoutStats] = useState<ScoutRunStats | null>(null);
  const [scoutNotes, setScoutNotes] = useState<string | null>(null);
  const [scoutDiagnostics, setScoutDiagnostics] = useState<ScoutRunDiagnostics | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImportingContacts, setIsImportingContacts] = useState(false);
  const [isScouting, setIsScouting] = useState(false);
  const [isRanking, setIsRanking] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshJobs();
    void refreshContacts();
    void refreshScoutRuns();
    void refreshScoutStats();
  }, []);

  async function refreshJobs(): Promise<void> {
    try {
      const result = await listJobs({ advisor_slug: "hirefrank", limit: 200 });
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

  async function handleSync(): Promise<void> {
    setError(null);
    setIsSyncing(true);
    try {
      await syncJobs({ advisor_slug: "hirefrank", category: "product", source: "network" });
      await refreshJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleRank(): Promise<void> {
    if (!selectedJobId) return;
    setError(null);
    setIsRanking(true);
    try {
      const result = await rankWarmPaths({
        advisor_slug: "hirefrank",
        job_cache_id: selectedJobId,
      });
      setRunId(result.run_id);
      setPaths(result.top_paths);
      setSelectedColleagueId(result.top_paths[0]?.colleague_id ?? null);
      setDraft(null);
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
      const run = await getScoutRun(runIdValue);
      setSelectedScoutRun(run);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDraft(): Promise<void> {
    if (!runId || !selectedColleagueId) return;
    setError(null);
    setIsDrafting(true);
    try {
      const result = await draftIntro({ run_id: runId, colleague_id: selectedColleagueId });
      setDraft(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDrafting(false);
    }
  }

  return (
    <AppLayout
      activeStep={activeStep}
      onStepChange={setActiveStep}
      contactCount={contactCount}
      jobCount={jobs.length}
      pathCount={paths.length}
      hasDraft={draft !== null}
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      ) : null}

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

      {activeStep === "rank" && (
        <RankedPathsList
          paths={paths}
          selectedColleagueId={selectedColleagueId}
          onSelectColleague={setSelectedColleagueId}
          onDraft={handleDraft}
          isDrafting={isDrafting}
        />
      )}

      {activeStep === "draft" && <IntroDraftPanel draft={draft} />}
    </AppLayout>
  );
}
