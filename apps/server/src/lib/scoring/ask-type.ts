export type AskType = "context" | "intro" | "referral";

const referralKeywords = ["recruiter", "recruiting", "talent", "people partner", "ta"];
const contextKeywords = ["manager", "director", "lead", "head of", "vp"];

export function classifyAskType(title: string): AskType {
  const normalized = title.toLowerCase();

  if (referralKeywords.some((word) => normalized.includes(word))) {
    return "referral";
  }

  if (contextKeywords.some((word) => normalized.includes(word))) {
    return "context";
  }

  return "intro";
}
