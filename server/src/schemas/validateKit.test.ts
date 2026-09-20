import { describe, it, expect } from "vitest";
import { validateKit } from "./validateKit";

describe("validateKit", () => {
  it("returns valid: true with the parsed kit for good data", () => {
    const result = validateKit({
      source: { company: "X", company_url: "https://x.com", role: "Eng", location: "", jd_chars: 10, researched_at: "now", pages_used: [] },
      company_brief: { summary: "", what_they_do: "", sources: [] },
      role: { title: "Eng", seniority: "", responsibilities: [], requirements: [] },
      questions: [],
      flashcards: [],
      schedule: { days_available: 1, days: [] },
      coverage: { uncovered_requirement_ids: [], passes: 0 },
    });

    expect(result.valid).toBe(true);
  });

  it("returns valid: false with readable error strings for bad data", () => {
    const result = validateKit({ nonsense: true });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(typeof result.errors[0]).toBe("string");
    }
  });
});