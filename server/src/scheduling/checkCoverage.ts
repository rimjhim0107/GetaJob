import type { Requirement, Question } from "../schemas/kit.schema";

export function checkCoverage(
  requirements: Requirement[],
  questions: Question[]
): string[] {
  const coveredIds = new Set<string>();

  for (const question of questions) {
    for (const reqId of question.requirement_ids) {
      coveredIds.add(reqId);
    }
  }

  const uncovered = requirements
    .filter((req) => !coveredIds.has(req.id))
    .map((req) => req.id);

  return uncovered;
}