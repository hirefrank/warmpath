import { describe, expect, test } from "bun:test";
import { classifyAskType } from "./ask-type";

describe("classifyAskType", () => {
  test("returns referral for recruiter titles", () => {
    expect(classifyAskType("Senior Technical Recruiter")).toBe("referral");
    expect(classifyAskType("Talent Partner")).toBe("referral");
  });

  test("returns context for leadership titles", () => {
    expect(classifyAskType("Engineering Manager")).toBe("context");
    expect(classifyAskType("VP Product")).toBe("context");
  });

  test("defaults to intro for individual contributor titles", () => {
    expect(classifyAskType("Software Engineer")).toBe("intro");
  });
});
