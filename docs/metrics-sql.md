# Metrics SQL Draft

## Rank to Draft Rate

```sql
SELECT
  COUNT(DISTINCT CASE WHEN e.name = 'intro_draft_generated' THEN e.run_id END) * 1.0 /
  NULLIF(COUNT(DISTINCT CASE WHEN e.name = 'warm_path_ranked' THEN e.run_id END), 0) AS rank_to_draft_rate
FROM warm_path_events e;
```

## Draft to Sent Rate

```sql
SELECT
  COUNT(DISTINCT CASE WHEN e.name = 'outreach_sent' THEN e.run_id END) * 1.0 /
  NULLIF(COUNT(DISTINCT CASE WHEN e.name = 'intro_draft_generated' THEN e.run_id END), 0) AS draft_to_sent_rate
FROM warm_path_events e;
```

## Reply Rate

```sql
SELECT
  COUNT(DISTINCT CASE WHEN e.name = 'outreach_replied' THEN e.run_id END) * 1.0 /
  NULLIF(COUNT(DISTINCT CASE WHEN e.name = 'outreach_sent' THEN e.run_id END), 0) AS reply_rate
FROM warm_path_events e;
```

## Intro Acceptance Rate

```sql
SELECT
  COUNT(DISTINCT CASE WHEN e.name = 'intro_accepted' THEN e.run_id END) * 1.0 /
  NULLIF(COUNT(DISTINCT CASE WHEN e.name = 'outreach_sent' THEN e.run_id END), 0) AS intro_acceptance_rate
FROM warm_path_events e;
```
