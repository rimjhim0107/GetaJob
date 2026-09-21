import fs from "fs";
import path from "path";
import { validateKit } from "../schemas/validateKit";
import type { Kit } from "../schemas/kit.schema";
import { runPipeline } from "../pipeline/runPipeline";

interface Case {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

interface KitResult {
  id: string;
  status: "ok" | "failed";
  kit: Kit | null;
  error: { code: string; message: string } | null;
}

function parseArgs(argv: string[]): { input: string; output: string } {
  const inputIndex = argv.indexOf("--input");
  const outputIndex = argv.indexOf("--output");

  if (inputIndex === -1 || outputIndex === -1) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }

  return {
    input: argv[inputIndex + 1],
    output: argv[outputIndex + 1],
  };
}

async function processCase(c: Case): Promise<KitResult> {
  try {
    const kit = await runPipeline({ jd: c.jd, companyUrl: c.company_url, days: c.days });
    const validation = validateKit(kit);  

    if (!validation.valid) {
      return {
        id: c.id,
        status: "failed",
        kit: null,
        error: { code: "INVALID_KIT_STRUCTURE", message: validation.errors.join("; ") },
      };
    }

    return { id: c.id, status: "ok", kit: validation.kit, error: null };
  } catch (err) {
    return {
      id: c.id,
      status: "failed",
      kit: null,
      error: { code: "UNEXPECTED_ERROR", message: err instanceof Error ? err.message : String(err) },
    };
  }
}

async function main() {
  const { input, output } = parseArgs(process.argv);

  const inputPath = path.resolve(process.cwd(), input);
  const outputPath = path.resolve(process.cwd(), output);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const cases: Case[] = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  console.log(`Loaded ${cases.length} case(s) from ${input}`);

  const results: KitResult[] = [];
  for (const c of cases) {
    console.log(`Processing ${c.id}...`);
    const result = await processCase(c);
    results.push(result);
    console.log(`  -> ${result.status}`);
  }

  const outputData = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: results,
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`Wrote ${results.length} result(s) to ${output}`);
}

main();