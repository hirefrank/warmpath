import type { Database } from "bun:sqlite";
import type {
  MessageChannel,
  OutreachWorkflowStatus,
  Reminder,
  WorkflowEntry,
} from "../../../../../packages/shared/src/contracts/warm-path";

interface WorkflowEntryRow {
  id: string;
  run_id: string;
  colleague_id: string;
  status: OutreachWorkflowStatus;
  channel: MessageChannel | null;
  note: string | null;
  created_at: string;
}

interface ReminderRow {
  id: string;
  run_id: string;
  colleague_id: string;
  due_at: string;
  channel: MessageChannel;
  message: string;
  status: Reminder["status"];
  created_at: string;
}

export function addWorkflowEntry(
  database: Database,
  input: {
    runId: string;
    colleagueId: string;
    status: OutreachWorkflowStatus;
    channel?: MessageChannel;
    note?: string;
  }
): WorkflowEntry {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  database
    .query(
      `
      INSERT INTO outreach_workflow_entries (id, run_id, colleague_id, status, channel, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      id,
      input.runId,
      input.colleagueId,
      input.status,
      input.channel ?? null,
      input.note ?? null,
      createdAt
    );

  return {
    id,
    run_id: input.runId,
    colleague_id: input.colleagueId,
    status: input.status,
    channel: input.channel,
    note: input.note,
    created_at: createdAt,
  };
}

export function listWorkflowTimeline(
  database: Database,
  input: { runId: string; colleagueId: string }
): WorkflowEntry[] {
  const rows = database
    .query(
      `
      SELECT id, run_id, colleague_id, status, channel, note, created_at
      FROM outreach_workflow_entries
      WHERE run_id = ? AND colleague_id = ?
      ORDER BY created_at ASC
      `
    )
    .all(input.runId, input.colleagueId) as WorkflowEntryRow[];

  return rows.map((row) => ({
    id: row.id,
    run_id: row.run_id,
    colleague_id: row.colleague_id,
    status: row.status,
    channel: row.channel ?? undefined,
    note: row.note ?? undefined,
    created_at: row.created_at,
  }));
}

export function addReminder(
  database: Database,
  input: {
    runId: string;
    colleagueId: string;
    dueAt: string;
    channel: MessageChannel;
    message: string;
  }
): Reminder {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  database
    .query(
      `
      INSERT INTO outreach_reminders (id, run_id, colleague_id, due_at, channel, message, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `
    )
    .run(id, input.runId, input.colleagueId, input.dueAt, input.channel, input.message, createdAt);

  return {
    id,
    run_id: input.runId,
    colleague_id: input.colleagueId,
    due_at: input.dueAt,
    channel: input.channel,
    message: input.message,
    status: "pending",
    created_at: createdAt,
  };
}

export function listReminders(
  database: Database,
  input: { runId: string; colleagueId: string }
): Reminder[] {
  const rows = database
    .query(
      `
      SELECT id, run_id, colleague_id, due_at, channel, message, status, created_at
      FROM outreach_reminders
      WHERE run_id = ? AND colleague_id = ?
      ORDER BY due_at ASC
      `
    )
    .all(input.runId, input.colleagueId) as ReminderRow[];

  return rows.map((row) => ({
    id: row.id,
    run_id: row.run_id,
    colleague_id: row.colleague_id,
    due_at: row.due_at,
    channel: row.channel,
    message: row.message,
    status: row.status,
    created_at: row.created_at,
  }));
}

export function updateReminderStatus(
  database: Database,
  input: { reminderId: string; status: Reminder["status"] }
): Reminder | null {
  database
    .query(
      `
      UPDATE outreach_reminders
      SET status = ?
      WHERE id = ?
      `
    )
    .run(input.status, input.reminderId);

  const row = database
    .query(
      `
      SELECT id, run_id, colleague_id, due_at, channel, message, status, created_at
      FROM outreach_reminders
      WHERE id = ?
      LIMIT 1
      `
    )
    .get(input.reminderId) as ReminderRow | null;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    run_id: row.run_id,
    colleague_id: row.colleague_id,
    due_at: row.due_at,
    channel: row.channel,
    message: row.message,
    status: row.status,
    created_at: row.created_at,
  };
}
