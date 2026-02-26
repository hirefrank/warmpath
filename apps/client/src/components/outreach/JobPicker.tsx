import type { NormalizedJob } from "@warmpath/shared/contracts/job";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
    <Card>
      <CardHeader>
        <CardTitle>Job Picker</CardTitle>
        <CardDescription>
          Sync jobs from your network and select one to rank warm paths.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          onClick={() => void props.onSync()}
          disabled={props.isSyncing}
        >
          {props.isSyncing ? "Syncing..." : "Sync Jobs"}
        </Button>

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
                {job.company} - {job.title}
              </option>
            ))}
          </Select>
        </div>

        <Button
          onClick={() => void props.onRank()}
          disabled={props.isRanking || !props.selectedJobId}
        >
          {props.isRanking ? "Ranking..." : "Rank Warm Paths"}
        </Button>
      </CardContent>
    </Card>
  );
}
