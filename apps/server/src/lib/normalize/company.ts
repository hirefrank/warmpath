const LEGAL_SUFFIXES = /\b(inc|incorporated|corp|corporation|llc|ltd|limited|plc|co|company|group|holdings)\b/g;

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(LEGAL_SUFFIXES, "")
    .replace(/\s+/g, " ")
    .trim();
}
