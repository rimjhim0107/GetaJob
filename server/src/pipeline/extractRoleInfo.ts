import { callLLM } from "../llm/client";
import { z } from "zod";

const RoleInfoSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
});

export async function extractRoleInfo(jd: string) {
  const prompt = `Extract the job title, seniority level, and a list of key responsibilities from this job description.

Job description:
"""
${jd}
"""

Rules:
- Only include responsibilities explicitly stated in the text. Do not invent any.
- seniority should be a short label like "Junior", "Mid", "Senior", "Staff", or "" if unclear.
- Respond with ONLY JSON, no other text:
{"title": "...", "seniority": "...", "responsibilities": ["...", "..."]}`;

  try {
    const raw = await callLLM(prompt);
    const parsed = JSON.parse(raw);
    const result = RoleInfoSchema.safeParse(parsed);
    if (result.success) return result.data;
  } catch {
    // fall through
  }
  return { title: "", seniority: "", responsibilities: [] };
}