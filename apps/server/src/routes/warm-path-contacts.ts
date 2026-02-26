import { Hono } from "hono";
import { getDatabase } from "../db";
import {
  findContactsByCompany,
  listContacts,
  upsertContacts,
  type ContactInput,
} from "../db/repositories/contacts";

const app = new Hono();

app.post("/api/warm-path/contacts/import", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const payloadContacts = Array.isArray(body.contacts)
      ? (body.contacts as ContactInput[])
      : [];

    const csvContacts = typeof body.csv === "string"
      ? parseLinkedInConnectionsCsv(body.csv)
      : [];

    const contacts = [...payloadContacts, ...csvContacts]
      .filter((item) => typeof item.name === "string" && item.name.trim().length > 0)
      .map((item) => ({
        name: item.name.trim(),
        current_title: item.current_title?.trim() || undefined,
        current_company: item.current_company?.trim() || undefined,
        linkedin_url: item.linkedin_url?.trim() || undefined,
        email: item.email?.trim() || undefined,
        connected_on: item.connected_on?.trim() || undefined,
      }));

    const imported = upsertContacts(getDatabase(), contacts);
    return c.json({ imported });
  } catch (error) {
    return c.json(
      {
        error: "Failed to import contacts",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.get("/api/warm-path/contacts", (c) => {
  const limit = Number(c.req.query("limit") ?? "200");
  const company = c.req.query("company");
  const contacts = company
    ? findContactsByCompany(getDatabase(), company)
    : listContacts(getDatabase(), limit);

  return c.json({ contacts, total: contacts.length });
});

export default app;

function parseLinkedInConnectionsCsv(csv: string): ContactInput[] {
  const rows = csv.split("\n");
  const headerIndex = rows.findIndex((row) => {
    const lower = row.toLowerCase();
    return lower.includes("first name") && lower.includes("company");
  });

  if (headerIndex < 0) {
    return [];
  }

  const headers = parseCsvRow(rows[headerIndex]).map((header) => header.toLowerCase().trim());
  const firstNameIndex = headers.findIndex((header) => header.includes("first name"));
  const lastNameIndex = headers.findIndex((header) => header.includes("last name"));
  const companyIndex = headers.findIndex((header) => header === "company");
  const positionIndex = headers.findIndex((header) => header === "position");
  const urlIndex = headers.findIndex((header) => header === "url");
  const emailIndex = headers.findIndex((header) => header.includes("email"));
  const connectedIndex = headers.findIndex((header) => header.includes("connected"));

  const contacts: ContactInput[] = [];

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const line = rows[i]?.trim();
    if (!line) continue;

    const values = parseCsvRow(line);
    const firstName = firstNameIndex >= 0 ? values[firstNameIndex]?.trim() ?? "" : "";
    const lastName = lastNameIndex >= 0 ? values[lastNameIndex]?.trim() ?? "" : "";
    const name = `${firstName} ${lastName}`.trim();
    if (!name) continue;

    contacts.push({
      name,
      current_company: companyIndex >= 0 ? values[companyIndex]?.trim() : undefined,
      current_title: positionIndex >= 0 ? values[positionIndex]?.trim() : undefined,
      linkedin_url: urlIndex >= 0 ? values[urlIndex]?.trim() : undefined,
      email: emailIndex >= 0 ? values[emailIndex]?.trim() : undefined,
      connected_on: connectedIndex >= 0 ? values[connectedIndex]?.trim() : undefined,
    });
  }

  return contacts;
}

function parseCsvRow(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}
