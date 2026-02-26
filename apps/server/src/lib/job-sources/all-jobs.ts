import type { NormalizedJob } from "../../../../../packages/shared/src/contracts/job";

export interface AllJobsFetchParams {
  category?: string;
  location?: string;
  seniority?: string;
}

export async function fetchAllJobs(_params: AllJobsFetchParams): Promise<NormalizedJob[]> {
  return [];
}
