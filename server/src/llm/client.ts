import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const client = new Groq({ apiKey: process.env.LLM_API_KEY });
const MODEL = process.env.LLM_MODEL || "openai/gpt-oss-20b";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exported separately so it can be tested without mocking the whole SDK
export function getBackoffDelay(attempt: number): number {
  return 1000 * Math.pow(2, attempt); // 2s, 4s, 8s
}

export async function callLLM(prompt: string, maxRetries = 3): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("LLM returned an empty response");
      }
      return content;
    } catch (err: any) {
      lastError = err;

      if (err?.status === 429) {
        const waitMs = getBackoffDelay(attempt);
        console.warn(`Rate limited by LLM provider. Retrying in ${waitMs}ms (attempt ${attempt}/${maxRetries})`);
        await sleep(waitMs);
        continue;
      }

      throw err;
    }
  }

  throw new Error(`LLM call failed after ${maxRetries} retries: ${lastError}`);
}