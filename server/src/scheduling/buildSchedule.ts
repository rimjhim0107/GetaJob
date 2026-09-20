import type { Requirement, Question, ScheduleDay } from "../schemas/kit.schema";

function isMustQuestion(question: Question, requirements: Requirement[]): boolean {
  return question.requirement_ids.some((reqId) => {
    const req = requirements.find((r) => r.id === reqId);
    return req?.priority === "must";
  });
}

function sortQuestions(questions: Question[], requirements: Requirement[]): Question[] {
  return [...questions].sort((a, b) => {
    const aMust = isMustQuestion(a, requirements);
    const bMust = isMustQuestion(b, requirements);

    // "must" questions come before "nice" questions
    if (aMust !== bMust) return aMust ? -1 : 1;

    // within the same priority, higher difficulty comes first
    return b.difficulty - a.difficulty;
  });
}

function minutesForQuestion(question: Question): number {
  // simple estimate: harder questions get more study time
  return question.difficulty * 15;
}

export function buildSchedule(
  requirements: Requirement[],
  questions: Question[],
  daysAvailable: number
): ScheduleDay[] {
  const sorted = sortQuestions(questions, requirements);

  const days: ScheduleDay[] = [];
  const baseSize = Math.floor(sorted.length / daysAvailable);
  const remainder = sorted.length % daysAvailable;

  let index = 0;
  for (let day = 1; day <= daysAvailable; day++) {
    // earlier days absorb the extra questions when it doesn't divide evenly
    const sizeForThisDay = baseSize + (day <= remainder ? 1 : 0);
    const dayQuestions = sorted.slice(index, index + sizeForThisDay);
    index += sizeForThisDay;

    days.push({
      day,
      focus: dayQuestions.length > 0 ? dayQuestions[0].category : "Review",
      question_ids: dayQuestions.map((q) => q.id),
      minutes: dayQuestions.reduce((sum, q) => sum + minutesForQuestion(q), 0),
    });
  }

  return days;
}