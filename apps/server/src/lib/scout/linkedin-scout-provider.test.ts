import { describe, expect, test } from "bun:test";
import {
  fallbackAnchorOnlyHtml,
  jsonBlobOnlyHtml,
  sampleLinkedInSearchHtml,
} from "./__fixtures__/linkedin-search-html";
import { parseSecondDegreeResultsFromHtml } from "./linkedin-scout-provider";

describe("parseSecondDegreeResultsFromHtml", () => {
  test("extracts candidates from LinkedIn search result blocks", () => {
    const results = parseSecondDegreeResultsFromHtml(sampleLinkedInSearchHtml, {
      targetCompany: "Acme",
      targetFunction: "product",
      targetTitle: "Senior Product Manager",
      limit: 10,
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.full_name).toBe("Taylor Candidate");
    expect(results[0]?.linkedin_url).toBe("https://www.linkedin.com/in/taylor-candidate-1234");
    expect(results[0]?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(results[1]?.full_name).toBe("Jordan Recruiter");
  });

  test("honors result limit and excludes navigation links", () => {
    const results = parseSecondDegreeResultsFromHtml(sampleLinkedInSearchHtml, {
      targetCompany: "Acme",
      limit: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.full_name.toLowerCase()).not.toContain("linkedin learning");
  });

  test("falls back to anchor parsing when result blocks are absent", () => {
    const results = parseSecondDegreeResultsFromHtml(fallbackAnchorOnlyHtml, {
      targetCompany: "Acme",
      targetFunction: "operations",
      targetTitle: "Operations Manager",
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.full_name).toBe("Alex Ops");
    expect(results[0]?.linkedin_url).toBe("https://www.linkedin.com/in/alex-ops-4512");
    expect(results[0]?.match_reason).toContain("fallback");
  });

  test("parses candidates from embedded JSON blob fallback", () => {
    const results = parseSecondDegreeResultsFromHtml(jsonBlobOnlyHtml, {
      targetCompany: "Acme",
      targetFunction: "product",
      targetTitle: "Product Manager",
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.full_name).toBe("Morgan Builder");
    expect(results[0]?.linkedin_url).toBe("https://www.linkedin.com/in/morgan-builder-55");
    expect(results[0]?.match_reason).toBe("linkedin_json_blob");
  });
});
