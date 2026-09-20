import { describe, it, expect } from "vitest";
import { KitSchema } from "./kit.schema";

describe("KitSchema", () => {
  it("accepts a valid, complete kit", () => {
    const validKit = {
      source: {
        company: "Acme Corp",
        company_url: "https://acme.example.com",
        role: "Senior Backend Engineer",
        location: "Remote",
        jd_chars: 1200,
        researched_at: "2026-09-20T10:00:00Z",
        pages_used: ["https://acme.example.com/careers"],
      },
      company_brief: {
        summary: "Acme builds developer tools.",
        what_they_do: "API infrastructure for startups.",
        sources: ["https://acme.example.com/about"],
      },
      role: {
        title: "Senior Backend Engineer",
        seniority: "Senior",
        responsibilities: ["Design APIs", "Mentor engineers"],
        requirements: [
          { id: "r1", text: "5+ years with Node.js", kind: "technical", priority: "must" },
        ],
      },
      questions: [
        {
          id: "q1",
          requirement_ids: ["r1"],
          category: "technical",
          prompt: "Explain event loop internals.",
          answer_outline: "Cover call stack, task queue, microtasks.",
          difficulty: 2,
        },
      ],
      flashcards: [
        { id: "f1", front: "What is Node's event loop?", back: "A single-threaded loop...", requirement_ids: ["r1"] },
      ],
      schedule: {
        days_available: 3,
        days: [{ day: 1, focus: "Core concepts", question_ids: ["q1"], minutes: 60 }],
      },
      coverage: { uncovered_requirement_ids: [], passes: 1 },
    };

    const result = KitSchema.safeParse(validKit);
    expect(result.success).toBe(true);
  });

  it("rejects a kit with an invalid priority value", () => {
    const invalidKit = {
      source: { company: "X", company_url: "https://x.com", role: "Eng", location: "", jd_chars: 10, researched_at: "now", pages_used: [] },
      company_brief: { summary: "", what_they_do: "", sources: [] },
      role: {
        title: "Eng",
        seniority: "",
        responsibilities: [],
        requirements: [{ id: "r1", text: "React", kind: "technical", priority: "REQUIRED" }], // invalid
      },
      questions: [],
      flashcards: [],
      schedule: { days_available: 1, days: [] },
      coverage: { uncovered_requirement_ids: [], passes: 0 },
    };

    const result = KitSchema.safeParse(invalidKit);
    expect(result.success).toBe(false);
  });

  it("rejects a kit with a non-integer duration", () => {
    const invalidKit = {
      source: { company: "X", company_url: "https://x.com", role: "Eng", location: "", jd_chars: 10, researched_at: "now", pages_used: [] },
      company_brief: { summary: "", what_they_do: "", sources: [] },
      role: { title: "Eng", seniority: "", responsibilities: [], requirements: [] },
      questions: [],
      flashcards: [],
      schedule: { days_available: 1, days: [{ day: 1, focus: "x", question_ids: [], minutes: 60.5 }] }, // invalid: float
      coverage: { uncovered_requirement_ids: [], passes: 0 },
    };

    const result = KitSchema.safeParse(invalidKit);
    expect(result.success).toBe(false);
  });
});