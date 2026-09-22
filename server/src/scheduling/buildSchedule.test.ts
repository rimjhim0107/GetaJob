import { describe, it, expect } from "vitest";
import { buildSchedule } from "./buildSchedule";
import type { Requirement, Question } from "../schemas/kit.schema";

const req = (id: string, priority: "must" | "nice" = "must"): Requirement => ({
  id,
  text: "some requirement",
  kind: "technical",
  priority,
});

const question = (
  id: string,
  requirement_ids: string[],
  difficulty: number
): Question => ({
  id,
  requirement_ids,
  category: "technical",
  prompt: "some question",
  answer_outline: "",
  difficulty,
  state: "generated",
});

describe("buildSchedule", () => {
  it("returns exactly the number of days requested", () => {
    const requirements = [req("r1")];
    const questions = [question("q1", ["r1"], 2)];

    const schedule = buildSchedule(requirements, questions, 4);
    expect(schedule.length).toBe(4);
  });

  it("places must-priority questions before nice-priority questions", () => {
    const requirements = [req("r1", "nice"), req("r2", "must")];
    const questions = [
      question("q1", ["r1"], 3), // nice, hard
      question("q2", ["r2"], 1), // must, easy
    ];

    const schedule = buildSchedule(requirements, questions, 2);
    // q2 (must) should appear on an earlier day than q1 (nice)
    const day1Ids = schedule[0].question_ids;
    expect(day1Ids).toContain("q2");
  });

  it("gives every day an integer minutes value", () => {
    const requirements = [req("r1")];
    const questions = [question("q1", ["r1"], 2), question("q2", ["r1"], 3)];

    const schedule = buildSchedule(requirements, questions, 2);
    schedule.forEach((day) => {
      expect(Number.isInteger(day.minutes)).toBe(true);
    });
  });

  it("handles more days than questions without crashing", () => {
    const requirements = [req("r1")];
    const questions = [question("q1", ["r1"], 1)];

    const schedule = buildSchedule(requirements, questions, 3);
    expect(schedule.length).toBe(3);
    expect(schedule.some((d) => d.question_ids.length === 0)).toBe(true);
  });
});