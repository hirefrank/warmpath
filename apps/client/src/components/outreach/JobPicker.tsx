import type { NormalizedJob } from "@warmpath/shared/contracts/job";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Briefcase, RefreshCw, BarChart3 } from "lucide-react";

interface JobPickerProps {
  jobs: NormalizedJob[];
  selectedJobId: string | null;
  isSyncing: boolean;
  isRanking: boolean;
  onSync: () => Promise<void>;
  onSelectJob: (jobId: string) => void;
  onRank: () => Promise<void>;
}

export function JobPicker(props: JobPickerProps) {
  return (
    <Card className="animate-fade-in-up overflow-hidden">
      <CardHeader className="border-b border-border/50 bg-accent/30">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Briefcase className="size-4 text-primary" />
          </div>
          <div>
            <CardTitle>Job Picker</CardTitle>
            <CardDescription>
              Sync jobs from your network and select one to rank warm paths.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <Button
          variant="outline"
          onClick={() => void props.onSync()}
          disabled={props.isSyncing}
          className="gap-2"
        >
          <RefreshCw className={`size-4 ${props.isSyncing ? "animate-spin" : ""}`} />
          {props.isSyncing ? "Syncing..." : "Sync Jobs"}
        </Button>

        {props.jobs.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="job-select">Select a job</Label>
            <Select
              id="job-select"
              value={props.selectedJobId ?? ""}
              onChange={(event) => props.onSelectJob(event.currentTarget.value)}
            >
              <option value="" disabled>
                Select a job
              </option>
              {props.jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.company} &mdash; {job.title}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
            <Briefcase className="mx-auto mb-2 size-5 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No jobs synced yet. Click "Sync Jobs" to get started.</p>
          </div>
        )}

        <Button
          onClick={() => void props.onRank()}
          disabled={props.isRanking || !props.selectedJobId}
          className="gap-2"
        >
          {props.isRanking ? (
            <>
              <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Ranking...
            </>
          ) : (
            <>
              <BarChart3 className="size-4" />
              Rank Warm Paths
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
