import { describe, it, expect } from "vitest";
import { checkCoverage } from "./checkCoverage";
import type { Requirement, Question } from "../schemas/kit.schema";

const req = (id: string): Requirement => ({
  id,
  text: "some requirement",
  kind: "technical",
  priority: "must",
});

const question = (id: string, requirement_ids: string[]): Question => ({
  id,
  requirement_ids,
  category: "technical",
  prompt: "some question",
  answer_outline: "",
  difficulty: 1,
  state: "generated",
});

describe("checkCoverage", () => {
  it("returns an empty array when every requirement has a question", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [question("q1", ["r1"]), question("q2", ["r2"])];

    expect(checkCoverage(requirements, questions)).toEqual([]);
  });

  it("returns the ids of requirements with no covering question", () => {
    const requirements = [req("r1"), req("r2"), req("r3")];
    const questions = [question("q1", ["r1"])];

    expect(checkCoverage(requirements, questions)).toEqual(["r2", "r3"]);
  });

  it("returns all requirement ids when there are no questions at all", () => {
    const requirements = [req("r1"), req("r2")];
    const questions: Question[] = [];

    expect(checkCoverage(requirements, questions)).toEqual(["r1", "r2"]);
  });

  it("handles a question covering multiple requirements", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [question("q1", ["r1", "r2"])];

    expect(checkCoverage(requirements, questions)).toEqual([]);
  });
});