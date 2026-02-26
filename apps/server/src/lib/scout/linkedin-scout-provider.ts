import type { ScoutProvider, ScoutProviderTarget } from "./second-degree-scout";

interface LinkedInScoutProviderOptions {
  liAtCookie?: string;
  requestTimeoutMs?: number;
  minDelayMs?: number;
}

let lastRequestAt = 0;

export class LinkedInScoutProvider implements ScoutProvider {
  readonly name = "linkedin_li_at";
  private readonly liAtCookie: string;
  private readonly requestTimeoutMs: number;
  private readonly minDelayMs: number;

  constructor(options: LinkedInScoutProviderOptions = {}) {
    this.liAtCookie = options.liAtCookie?.trim() ?? "";
    this.requestTimeoutMs = options.requestTimeoutMs ?? 15000;
    this.minDelayMs = options.minDelayMs ?? 1200;
  }

  isConfigured(): boolean {
    return this.liAtCookie.length > 0;
  }

  async searchCompanySecondDegree(input: {
    targetCompany: string;
    targetFunction?: string;
    targetTitle?: string;
    limit: number;
  }): Promise<ScoutProviderTarget[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const sessionValid = await this.validateSession();
    if (!sessionValid) {
      return [];
    }

    const queries = buildQueryCandidates(input);
    const results: ScoutProviderTarget[] = [];
    const seen = new Set<string>();

    for (const query of queries) {
      if (results.length >= input.limit) {
        break;
      }

      await this.enforceRateLimit();
      const html = await this.fetchSearchHtml(query);
      const parsed = parseSecondDegreeResultsFromHtml(html, {
        targetCompany: input.targetCompany,
        targetFunction: input.targetFunction,
        targetTitle: input.targetTitle,
        limit: input.limit - results.length,
      });

      for (const candidate of parsed) {
        const withReason: ScoutProviderTarget = {
          ...candidate,
          match_reason: candidate.match_reason ?? `linkedin_search:${query}`,
        };

        const dedupeKey = withReason.linkedin_url ?? withReason.full_name.toLowerCase();
        if (seen.has(dedupeKey)) {
          continue;
        }

        seen.add(dedupeKey);
        results.push(withReason);
        if (results.length >= input.limit) {
          break;
        }
      }
    }

    return results;
  }

  private async validateSession(): Promise<boolean> {
    try {
      const response = await fetch("https://www.linkedin.com/feed/", {
        method: "GET",
        redirect: "manual",
        headers: {
          Cookie: `li_at=${this.liAtCookie}`,
          "User-Agent": DEFAULT_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (response.status === 200) {
        return true;
      }

      if (response.status >= 300 && response.status < 400) {
        return false;
      }

      return false;
    } catch {
      return false;
    }
  }

  private async fetchSearchHtml(query: string): Promise<string> {
    const url = new URL("https://www.linkedin.com/search/results/people/");
    url.searchParams.set("keywords", query);
    url.searchParams.set("network", '["S"]');
    url.searchParams.set("origin", "GLOBAL_SEARCH_HEADER");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        signal: controller.signal,
        headers: {
          Cookie: `li_at=${this.liAtCookie}`,
          "User-Agent": DEFAULT_USER_AGENT,
          "Accept-Language": "en-US,en;q=0.9",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: "https://www.linkedin.com/feed/",
        },
      });

      if (!response.ok || response.url.includes("/login")) {
        return "";
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastRequestAt;
    if (elapsed < this.minDelayMs) {
      await sleep(this.minDelayMs - elapsed);
    }
    lastRequestAt = Date.now();
  }
}

export function createLinkedInScoutProviderFromEnv(): LinkedInScoutProvider {
  return new LinkedInScoutProvider({
    liAtCookie:
      process.env.LINKEDIN_LI_AT ??
      process.env.LINKEDIN_LI_AT_COOKIE ??
      process.env.LI_AT,
    requestTimeoutMs: parseOptionalNumber(process.env.LINKEDIN_REQUEST_TIMEOUT_MS) ?? 15000,
    minDelayMs: parseOptionalNumber(process.env.LINKEDIN_RATE_LIMIT_MS) ?? 1200,
  });
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function buildQueryCandidates(input: {
  targetCompany: string;
  targetFunction?: string;
  targetTitle?: string;
}): string[] {
  const first = [input.targetCompany, input.targetFunction, input.targetTitle]
    .filter((value): value is string => Boolean(value && value.trim().length > 0))
    .join(" ")
    .trim();

  const candidates = [first, input.targetCompany.trim()].filter((value) => value.length > 0);
  return Array.from(new Set(candidates));
}

export function parseSecondDegreeResultsFromHtml(
  html: string,
  input: {
    targetCompany: string;
    targetFunction?: string;
    targetTitle?: string;
    limit: number;
  }
): ScoutProviderTarget[] {
  if (!html || input.limit <= 0) {
    return [];
  }

  const output: ScoutProviderTarget[] = [];
  const seenUrls = new Set<string>();
  const blocks = extractCandidateBlocks(html);

  if (blocks.length > 0) {
    for (const block of blocks) {
      if (output.length >= input.limit) {
        break;
      }

      const candidate = parseResultBlock(block, input);
      if (!candidate?.linkedin_url) {
        continue;
      }

      if (seenUrls.has(candidate.linkedin_url)) {
        continue;
      }

      seenUrls.add(candidate.linkedin_url);
      output.push(candidate);
    }
  }

  if (output.length >= input.limit) {
    return output.slice(0, input.limit);
  }

  const jsonFallback = parseSecondDegreeResultsFromJsonBlob(html, input);
  for (const candidate of jsonFallback) {
    if (output.length >= input.limit) {
      break;
    }

    const key = candidate.linkedin_url ?? candidate.full_name.toLowerCase();
    if (seenUrls.has(key)) {
      continue;
    }

    if (candidate.linkedin_url) {
      seenUrls.add(candidate.linkedin_url);
    } else {
      seenUrls.add(candidate.full_name.toLowerCase());
    }

    output.push(candidate);
  }

  if (output.length >= input.limit) {
    return output.slice(0, input.limit);
  }

  const anchors = Array.from(
    html.matchAll(/<a[^>]*href="([^"]*\/in\/[^"]+)"[^>]*>([\s\S]{0,500}?)<\/a>/gi)
  );

  for (const match of anchors) {
    if (output.length >= input.limit) {
      break;
    }

    const fullMatch = match[0];
    const href = match[1] ?? "";
    const linkInner = match[2] ?? "";
    const name = normalizeWhitespace(stripHtml(linkInner)) || nameFromProfileUrl(href);

    if (!name || isLikelyNavigationName(name)) {
      continue;
    }

    const url = normalizeLinkedInProfileUrl(href);
    if (!url || seenUrls.has(url)) {
      continue;
    }

    const windowStart = Math.max(0, (match.index ?? 0) - 800);
    const windowEnd = Math.min(html.length, (match.index ?? 0) + fullMatch.length + 1200);
    const contextWindow = html.slice(windowStart, windowEnd);

    if (!/entity-result|search-result|reusable-search/i.test(contextWindow)) {
      continue;
    }

    const subtitle = normalizeWhitespace(
      stripHtml(captureGroup(contextWindow, /entity-result__primary-subtitle[^>]*>([\s\S]*?)<\//i) ?? "")
    );
    const companyLine = normalizeWhitespace(
      stripHtml(captureGroup(contextWindow, /entity-result__secondary-subtitle[^>]*>([\s\S]*?)<\//i) ?? "")
    );

    const confidence = estimateConfidence(
      {
        subtitle,
        companyLine,
      },
      input
    );

    seenUrls.add(url);
    output.push({
      full_name: name,
      headline: subtitle || undefined,
      current_title: subtitle || undefined,
      current_company: companyLine || undefined,
      linkedin_url: url,
      confidence,
      match_reason: "linkedin_search_html_fallback",
    });
  }

  return output;
}

function parseSecondDegreeResultsFromJsonBlob(
  html: string,
  input: {
    targetCompany: string;
    targetFunction?: string;
    targetTitle?: string;
    limit: number;
  }
): ScoutProviderTarget[] {
  const matches = Array.from(
    html.matchAll(
      /"firstName"\s*:\s*"([^"]+)"[\s\S]{0,700}?"lastName"\s*:\s*"([^"]+)"[\s\S]{0,700}?"publicIdentifier"\s*:\s*"([^"]+)"[\s\S]{0,1200}?(?:"occupation"\s*:\s*"([^"]+)")?/gi
    )
  );

  if (matches.length === 0) {
    return [];
  }

  const results: ScoutProviderTarget[] = [];
  for (const match of matches) {
    if (results.length >= input.limit) {
      break;
    }

    const firstName = normalizeWhitespace(match[1] ?? "");
    const lastName = normalizeWhitespace(match[2] ?? "");
    const publicIdentifier = normalizeWhitespace(match[3] ?? "");
    const occupation = normalizeWhitespace(decodeHtmlEntities(match[4] ?? ""));

    const fullName = normalizeWhitespace(`${firstName} ${lastName}`);
    if (!fullName || !publicIdentifier) {
      continue;
    }

    const linkedinUrl = normalizeLinkedInProfileUrl(`/in/${publicIdentifier}`);
    if (!linkedinUrl) {
      continue;
    }

    const confidence = estimateConfidence(
      {
        subtitle: occupation,
        companyLine: occupation,
      },
      input
    );

    results.push({
      full_name: fullName,
      headline: occupation || undefined,
      current_title: occupation || undefined,
      current_company: occupation || undefined,
      linkedin_url: linkedinUrl,
      confidence,
      match_reason: "linkedin_json_blob",
    });
  }

  return results;
}

function extractCandidateBlocks(html: string): string[] {
  const blockMatches = Array.from(
    html.matchAll(/<li[^>]*reusable-search__result-container[^>]*>[\s\S]*?<\/li>/gi)
  );

  return blockMatches.map((match) => match[0]);
}

function parseResultBlock(
  block: string,
  input: { targetCompany: string; targetFunction?: string; targetTitle?: string }
): ScoutProviderTarget | null {
  const href =
    captureGroup(block, /<a[^>]*href="([^"]*\/in\/[^"]+)"/i) ??
    captureGroup(block, /href='([^']*\/in\/[^']+)'/i);

  if (!href) {
    return null;
  }

  const url = normalizeLinkedInProfileUrl(href);
  if (!url) {
    return null;
  }

  const name =
    normalizeWhitespace(
      stripHtml(
        captureGroup(block, /entity-result__title-text[^>]*>[\s\S]*?aria-hidden="true"[^>]*>([\s\S]*?)<\/span>/i) ??
          captureGroup(block, /entity-result__title-text[^>]*>([\s\S]*?)<\/div>/i) ??
          captureGroup(block, /<a[^>]*href="[^"]*\/in\/[^"]+"[^>]*>([\s\S]{0,500}?)<\/a>/i) ??
          ""
      )
    ) || nameFromProfileUrl(url);

  if (!name || isLikelyNavigationName(name)) {
    return null;
  }

  const subtitle = normalizeWhitespace(
    stripHtml(
      captureGroup(block, /entity-result__primary-subtitle[^>]*>([\s\S]*?)<\/div>/i) ??
        captureGroup(block, /t-14\s+t-black\s+t-normal[^>]*>([\s\S]*?)<\/div>/i) ??
        ""
    )
  );

  const companyLine = normalizeWhitespace(
    stripHtml(
      captureGroup(block, /entity-result__secondary-subtitle[^>]*>([\s\S]*?)<\/div>/i) ??
        captureGroup(block, /entity-result__summary[^>]*>([\s\S]*?)<\/p>/i) ??
        ""
    )
  );

  const confidence = estimateConfidence(
    {
      subtitle,
      companyLine,
    },
    input
  );

  return {
    full_name: name,
    headline: subtitle || undefined,
    current_title: subtitle || undefined,
    current_company: companyLine || undefined,
    linkedin_url: url,
    confidence,
    match_reason: "linkedin_search_html",
  };
}

function captureGroup(text: string, regex: RegExp): string | null {
  const match = text.match(regex);
  return match?.[1] ?? null;
}

function normalizeLinkedInProfileUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.includes("/in/")) {
    return null;
  }

  const absolute = trimmed.startsWith("http")
    ? trimmed
    : `https://www.linkedin.com${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;

  try {
    const parsed = new URL(absolute);
    parsed.search = "";
    parsed.hash = "";
    if (parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function nameFromProfileUrl(urlOrPath: string): string {
  try {
    const absolute = normalizeLinkedInProfileUrl(urlOrPath);
    if (!absolute) {
      return "";
    }

    const parsed = new URL(absolute);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const slug = parts[1] ?? "";
    if (!slug) {
      return "";
    }

    const cleaned = decodeURIComponent(slug)
      .replace(/[0-9]+/g, " ")
      .replace(/[-_]+/g, " ")
      .trim();

    if (!cleaned) {
      return "";
    }

    return cleaned
      .split(/\s+/)
      .filter((token) => token.length > 1)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");
  } catch {
    return "";
  }
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function isLikelyNavigationName(name: string): boolean {
  if (name.length < 3 || name.length > 80) {
    return true;
  }

  const lower = name.toLowerCase();
  return (
    lower.includes("linkedin") ||
    lower.includes("search") ||
    lower.includes("learning") ||
    lower.includes("advertising") ||
    lower.includes("try premium") ||
    lower.includes("view profile") ||
    lower.includes("message") ||
    lower.includes("connect")
  );
}

function estimateConfidence(
  context: { subtitle: string; companyLine: string },
  input: { targetCompany: string; targetFunction?: string; targetTitle?: string }
): number {
  let score = 0.4;
  const title = context.subtitle.toLowerCase();
  const company = context.companyLine.toLowerCase();
  const targetCompany = input.targetCompany.toLowerCase();

  if (company.includes(targetCompany)) {
    score += 0.3;
  }

  if (input.targetFunction && title.includes(input.targetFunction.toLowerCase())) {
    score += 0.15;
  }

  if (input.targetTitle) {
    const tokens = input.targetTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 2);

    const tokenMatches = tokens.filter((token) => title.includes(token)).length;
    if (tokenMatches > 0) {
      score += Math.min(0.2, tokenMatches * 0.06);
    }
  }

  return Math.max(0.2, Math.min(0.95, Number(score.toFixed(2))));
}

function parseOptionalNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
