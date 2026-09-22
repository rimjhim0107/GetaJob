import { callLLM } from "../llm/client";
import { z } from "zod";
import type { Requirement, Flashcard } from "../schemas/kit.schema";

const FlashcardItemSchema = z.object({
  front: z.string(),
  back: z.string(),
});
const FlashcardItemsSchema = z.array(FlashcardItemSchema);

let flashcardCounter = 0;

export async function generateFlashcardsForRequirement(requirement: Requirement): Promise<Flashcard[]> {
  const prompt = `Generate 2 flashcards (front/back) for quick review of this interview topic.

Requirement: "${requirement.text}"

Rules:
- "front" is a short prompt/question, "back" is a concise answer (1-3 sentences)
- Respond with ONLY JSON, no other text:
[{"front": "...", "back": "..."}]`;

  try {
    const raw = await callLLM(prompt);
    const parsed = JSON.parse(raw);
    const result = FlashcardItemsSchema.safeParse(parsed);
    if (result.success) {
            return result.data.map((f) => {
        flashcardCounter++;
        return { id: `f${flashcardCounter}`, front: f.front, back: f.back, requirement_ids: [requirement.id], state: "generated" as const };
      });
    }
  } catch {
    // skip flashcards for this requirement on failure, don't fail the whole kit
  }
  return [];
}