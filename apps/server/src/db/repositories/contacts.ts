import type { Database } from "bun:sqlite";

export interface ContactInput {
  id?: string;
  name: string;
  current_title?: string;
  current_company?: string;
  linkedin_url?: string;
  email?: string;
  connected_on?: string;
}

export interface ContactRecord {
  id: string;
  name: string;
  current_title: string | null;
  current_company: string | null;
  linkedin_url: string | null;
  email: string | null;
  connected_on: string | null;
}

export function upsertContacts(database: Database, contacts: ContactInput[]): number {
  if (contacts.length === 0) {
    return 0;
  }

  const statement = database.query<unknown, any[]>(
    `
    INSERT INTO contacts (
      id, name, current_title, current_company, linkedin_url, email, connected_on, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      current_title = excluded.current_title,
      current_company = excluded.current_company,
      linkedin_url = excluded.linkedin_url,
      email = excluded.email,
      connected_on = excluded.connected_on,
      updated_at = datetime('now')
    `
  ) as any;

  const selectByLinkedin = database.query<{ id: string }, [string]>(
    `SELECT id FROM contacts WHERE linkedin_url = ? LIMIT 1`
  ) as any;

  const selectByNameCompany = database.query<{ id: string }, [string, string]>(
    `
    SELECT id
    FROM contacts
    WHERE LOWER(name) = LOWER(?)
      AND LOWER(COALESCE(current_company, '')) = LOWER(?)
    LIMIT 1
    `
  ) as any;

  const transaction = database.transaction((records: ContactInput[]) => {
    for (const contact of records) {
      const contactId =
        contact.id ??
        findExistingId(contact, selectByLinkedin, selectByNameCompany) ??
        buildContactId(contact);

      statement.run(
        contactId,
        contact.name,
        contact.current_title ?? null,
        contact.current_company ?? null,
        contact.linkedin_url ?? null,
        contact.email ?? null,
        contact.connected_on ?? null
      );
    }
  });

  transaction(contacts);
  return contacts.length;
}

export function listContacts(database: Database, limit: number = 1000): ContactRecord[] {
  const safeLimit = Math.max(1, Math.floor(limit));
  const rows = (database.query<ContactRecord, []>(
    `
    SELECT id, name, current_title, current_company, linkedin_url, email, connected_on
    FROM contacts
    ORDER BY name
    LIMIT ${safeLimit}
    `
  ) as any).all() as ContactRecord[];

  return rows;
}

export function findContactsByCompany(database: Database, company: string): ContactRecord[] {
  const escaped = escapeSql(company.toLowerCase());

  const rows = (database.query<ContactRecord, []>(
    `
    SELECT id, name, current_title, current_company, linkedin_url, email, connected_on
    FROM contacts
    WHERE LOWER(COALESCE(current_company, '')) LIKE '%${escaped}%'
    ORDER BY name
    `
  ) as any).all() as ContactRecord[];

  return rows;
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function buildContactId(contact: ContactInput): string {
  const linkedin = contact.linkedin_url?.trim().toLowerCase();
  if (linkedin) {
    return `linkedin:${linkedin}`;
  }

  const name = contact.name.trim().toLowerCase().replace(/\s+/g, "-");
  const company = (contact.current_company ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

  return `contact:${name}:${company}`;
}

function findExistingId(
  contact: ContactInput,
  selectByLinkedin: { get: (...args: unknown[]) => { id: string } | null },
  selectByNameCompany: { get: (...args: unknown[]) => { id: string } | null }
): string | null {
  const linkedin = contact.linkedin_url?.trim();
  if (linkedin) {
    const byLinkedin = selectByLinkedin.get(linkedin);
    if (byLinkedin?.id) {
      return byLinkedin.id;
    }
  }

  const company = contact.current_company?.trim() ?? "";
  const byNameCompany = selectByNameCompany.get(contact.name, company);
  return byNameCompany?.id ?? null;
}
