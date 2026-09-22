import { callLLM } from "../llm/client";
import { z } from "zod";
import { QuestionCategory } from "../schemas/kit.schema";
import type { Requirement, Question } from "../schemas/kit.schema";

const GeneratedQuestionSchema = z.object({
  prompt: z.string(),
  answer_outline: z.string(),
  difficulty: z.number().int().min(1).max(3),
  category: QuestionCategory,
});
const GeneratedQuestionsSchema = z.array(GeneratedQuestionSchema);

function buildPrompt(requirement: Requirement): string {
  return `Generate 4 interview questions for this requirement from a job description.

Requirement: "${requirement.text}"
Requirement type: ${requirement.kind}

Rules:
- Generate a mix of categories where relevant: "technical", "behavioural", "system-design", "company-fit"
- Vary the difficulty across the 4 questions (mix of 1, 2, and 3)
- category must be one of: "technical", "behavioural", "system-design", "company-fit"
- difficulty must be an integer 1-3
- Respond with ONLY a JSON array, no other text, in this exact shape:
[{"prompt": "...", "answer_outline": "...", "difficulty": 2, "category": "technical"}]`;
}

function generateQuestionId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function generateQuestionsForRequirement(
  requirement: Requirement
): Promise<Question[]> {
  const raw = await callLLM(buildPrompt(requirement));

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`LLM did not return valid JSON for questions on requirement ${requirement.id}`);
  }

  const result = GeneratedQuestionsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`LLM questions did not match expected shape: ${result.error.message}`);
  }

    return result.data.map((q) => {
    return {
      id: generateQuestionId(),
      requirement_ids: [requirement.id],
      state: "generated" as const,
      ...q,
    };
  });
}