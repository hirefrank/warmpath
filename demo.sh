#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required but not found on PATH"
  exit 1
fi

export WARMPATH_DB_PATH="${WARMPATH_DB_PATH:-/tmp/warmpath-demo-$(date +%s).db}"
export DEMO_ADVISOR_SLUG="${DEMO_ADVISOR_SLUG:-hirefrank}"
export DEMO_CATEGORY="${DEMO_CATEGORY:-product}"

rm -f "$WARMPATH_DB_PATH"

echo "Running WarmPath demo"
echo "- root: $ROOT_DIR"
echo "- db:   $WARMPATH_DB_PATH"
echo "- slug: $DEMO_ADVISOR_SLUG"
echo "- cat:  $DEMO_CATEGORY"

bun --cwd "$ROOT_DIR/apps/server" -e "$(cat <<'EOF'
import app from './src/index.ts';

const advisorSlug = process.env.DEMO_ADVISOR_SLUG ?? 'hirefrank';
const category = process.env.DEMO_CATEGORY ?? 'product';

function printStep(title, payload) {
  console.log(`\n=== ${title} ===`);
  if (typeof payload === 'string') {
    console.log(payload);
    return;
  }
  console.log(JSON.stringify(payload, null, 2));
}

async function request(method, path, body) {
  const init = { method };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  const response = await app.request(path, init);
  const text = await response.text();
  let parsed = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Keep raw text when response is not JSON.
  }

  return {
    status: response.status,
    body: parsed,
  };
}

const health = await request('GET', '/api/health');
printStep('Health', health);

const sync = await request('POST', '/api/warm-path/jobs/sync', {
  advisor_slug: advisorSlug,
  category,
  source: 'network',
});
printStep('Jobs Sync', sync);

const jobsList = await request(
  'GET',
  `/api/warm-path/jobs?advisor_slug=${encodeURIComponent(advisorSlug)}&category=${encodeURIComponent(category)}&limit=5`
);
printStep('Jobs List', jobsList);

const jobs = Array.isArray(jobsList.body?.jobs) ? jobsList.body.jobs : [];
if (jobs.length === 0) {
  throw new Error('No jobs found. Try a different DEMO_CATEGORY.');
}

const selectedJob = jobs[0];
printStep('Selected Job', selectedJob);

const importContacts = await request('POST', '/api/warm-path/contacts/import', {
  contacts: [
    {
      name: 'Jamie Recruiter',
      current_title: 'Senior Recruiter',
      current_company: selectedJob.company,
      connected_on: '2024-06-01',
    },
    {
      name: 'Riley Manager',
      current_title: `${selectedJob.title} Manager`,
      current_company: selectedJob.company,
      connected_on: '2022-03-15',
    },
    {
      name: 'Alex Peer',
      current_title: selectedJob.title,
      current_company: selectedJob.company,
      connected_on: '2019-07-10',
    },
  ],
});
printStep('Contacts Import', importContacts);

const rank = await request('POST', '/api/warm-path/rank', {
  advisor_slug: advisorSlug,
  job_cache_id: selectedJob.id,
});
printStep('Warm Path Rank', rank);

const runId = rank.body?.run_id;
const topPaths = Array.isArray(rank.body?.top_paths) ? rank.body.top_paths : [];

if (runId && topPaths.length > 0) {
  const draft = await request('POST', `/api/warm-path/runs/${runId}/intro-draft`, {
    colleague_id: topPaths[0].colleague_id,
    extra_context: 'Demo run for outreach planning',
  });
  printStep('Intro Draft', draft);
} else {
  printStep('Intro Draft', 'Skipped: no ranked paths were returned.');
}

const scoutSeeded = await request('POST', '/api/warm-path/scout/run', {
  target_company: selectedJob.company,
  target_function: selectedJob.category ?? category,
  target_title: selectedJob.title,
  seed_targets: [
    {
      full_name: 'Taylor Candidate',
      current_title: selectedJob.title,
      current_company: selectedJob.company,
      confidence: 0.82,
    },
  ],
});
printStep('Scout Run (Seeded)', scoutSeeded);

const scoutNoSeed = await request('POST', '/api/warm-path/scout/run', {
  target_company: selectedJob.company,
  target_function: selectedJob.category ?? category,
  target_title: selectedJob.title,
});
printStep('Scout Run (No Seeds)', scoutNoSeed);

const scoutStats = await request('GET', '/api/warm-path/scout/stats');
printStep('Scout Stats', scoutStats);

console.log('\nDemo complete.');
EOF
)"

echo ""
echo "Done. DB persisted at: $WARMPATH_DB_PATH"
