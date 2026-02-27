import { describe, expect, test } from "bun:test";
import { rankContacts } from "./ranker";

describe("rankContacts", () => {
  test("sorts results by score descending", () => {
    const ranked = rankContacts([
      {
        colleagueId: "low",
        name: "Low Score",
        title: "Engineer",
        companyAffinity: 10,
        roleRelevance: 10,
        relationshipStrength: 5,
        sharedContext: 4,
        confidence: 2,
      },
      {
        colleagueId: "high",
        name: "High Score",
        title: "Recruiter",
        companyAffinity: 35,
        roleRelevance: 20,
        relationshipStrength: 15,
        sharedContext: 12,
        confidence: 5,
      },
    ]);

    expect(ranked[0]?.colleague_id).toBe("high");
    expect(ranked[1]?.colleague_id).toBe("low");
  });

  test("clamps dimensions to supported max values", () => {
    const ranked = rankContacts([
      {
        colleagueId: "over",
        name: "Over Max",
        title: "Manager",
        companyAffinity: 100,
        roleRelevance: 100,
        relationshipStrength: 100,
        sharedContext: 100,
        confidence: 100,
      },
    ]);

    expect(ranked[0]?.company_affinity).toBe(35);
    expect(ranked[0]?.role_relevance).toBe(25);
    expect(ranked[0]?.relationship_strength).toBe(20);
    expect(ranked[0]?.shared_context).toBe(15);
    expect(ranked[0]?.confidence).toBe(5);
    expect(ranked[0]?.total_score).toBeLessThanOrEqual(100);
  });

  test("supports custom weight profiles", () => {
    const ranked = rankContacts(
      [
        {
          colleagueId: "relationship-heavy",
          name: "Relationship Heavy",
          title: "Engineer",
          companyAffinity: 10,
          roleRelevance: 10,
          relationshipStrength: 20,
          sharedContext: 10,
          confidence: 3,
        },
        {
          colleagueId: "company-heavy",
          name: "Company Heavy",
          title: "Engineer",
          companyAffinity: 35,
          roleRelevance: 18,
          relationshipStrength: 6,
          sharedContext: 5,
          confidence: 2,
        },
      ],
      {
        companyAffinity: 15,
        roleRelevance: 10,
        relationshipStrength: 50,
        sharedContext: 20,
        confidence: 5,
      }
    );

    expect(ranked[0]?.colleague_id).toBe("relationship-heavy");
  });
});
