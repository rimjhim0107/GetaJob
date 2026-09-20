import { callLLM } from "../llm/client";
import { z } from "zod";
import { RequirementKind, RequirementPriority } from "../schemas/kit.schema";
import type { Requirement } from "../schemas/kit.schema";

// Schema for what we expect the LLM to return (before we add stable ids ourselves)
const ExtractedRequirementSchema = z.object({
  text: z.string(),
  kind: RequirementKind,
  priority: RequirementPriority,
});
const ExtractedRequirementsSchema = z.array(ExtractedRequirementSchema);

function buildPrompt(jd: string): string {
  return `You are extracting requirements from a job description.

Rules:
- Only include requirements that are explicitly stated in the text below. Do not invent or infer anything not written.
- Mark a requirement "must" only if the text uses required/mandatory language (e.g. "required", "must have", "X+ years").
- Mark a requirement "nice" if the text uses optional language (e.g. "nice to have", "bonus points", "preferred").
- kind must be one of: "technical", "behavioural", "domain".
- Respond with ONLY a JSON array, no other text, in this exact shape:
[{"text": "...", "kind": "technical", "priority": "must"}]

Job description:
"""
${jd}
"""`;
}

export async function extractRequirements(jd: string): Promise<Requirement[]> {
  const prompt = buildPrompt(jd);
  const raw = await callLLM(prompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("LLM did not return valid JSON for requirements");
  }

  const result = ExtractedRequirementsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`LLM requirements did not match expected shape: ${result.error.message}`);
  }

  // add our own stable ids, since the LLM shouldn't be trusted to generate unique ids
  return result.data.map((req, index) => ({
    id: `r${index + 1}`,
    ...req,
  }));
}