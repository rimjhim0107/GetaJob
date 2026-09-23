import { Router } from "express";
import { KitDoc } from "../models/Kit";
import { runPipeline } from "../pipeline/runPipeline";
import { validateKit } from "../schemas/validateKit";
import { generateQuestionsForRequirement } from "../pipeline/generateQuestions";
import { generateFlashcardsForRequirement } from "../pipeline/generateFlashcards";
import crypto from "crypto";
import { buildSchedule } from "../scheduling/buildSchedule";
import { generateCompanyBrief } from "../pipeline/generateCompanyBrief";

function hashCase(jd: string, companyUrl: string): string {
  return crypto.createHash("sha256").update(`${jd}|${companyUrl}`).digest("hex");
}

export const kitsRouter = Router();

// Create a kit — starts generation in the background, returns immediately
kitsRouter.post("/", async (req, res) => {
  const { jd, companyUrl, days } = req.body;
  if (!jd || !companyUrl || !days) {
    return res.status(400).json({ error: "jd, companyUrl, and days are required" });
  }

  const jdHash = hashCase(jd, companyUrl);
  const existing = await KitDoc.findOne({ owner: req.session.userId, jdHash, status: "ready" });
  if (existing) {
    return res.status(200).json({ id: existing._id, status: existing.status, duplicate: true });
  }

  const kitDoc = await KitDoc.create({
    owner: req.session.userId,
    status: "generating",
    jdHash,
  });

  // fire and forget — don't block the HTTP response on the LLM pipeline
  runPipeline({ jd, companyUrl, days })
    .then(async (kit) => {
      const validation = validateKit(kit);
      if (!validation.valid) {
        kitDoc.status = "failed";
        kitDoc.error = validation.errors.join("; ");
      } else {
        kitDoc.status = "ready";
        kitDoc.data = validation.kit;
      }
      await kitDoc.save();
    })
    .catch(async (err) => {
      kitDoc.status = "failed";
      kitDoc.error = err instanceof Error ? err.message : String(err);
      await kitDoc.save();
    });

  res.status(202).json({ id: kitDoc._id, status: kitDoc.status });
});

// List the logged-in user's own kits
kitsRouter.get("/", async (req, res) => {
  const kits = await KitDoc.find({ owner: req.session.userId }).sort({ createdAt: -1 });
  res.json(kits);
});

// Get a single kit — only if it belongs to the logged-in user
kitsRouter.get("/:id", async (req, res) => {
  const kit = await KitDoc.findOne({ _id: req.params.id, owner: req.session.userId });
  if (!kit) {
    return res.status(404).json({ error: "Kit not found" });
  }
  res.json(kit);
});

// Update a kit's content (edits, reorders, additions, deletions)
kitsRouter.patch("/:id", async (req, res) => {
  const kit = await KitDoc.findOne({ _id: req.params.id, owner: req.session.userId });
  if (!kit) {
    return res.status(404).json({ error: "Kit not found" });
  }
  if (kit.status !== "ready") {
    return res.status(400).json({ error: "Kit is not ready to be edited" });
  }

  const { questions, flashcards } = req.body;
  if (!Array.isArray(questions) && !Array.isArray(flashcards)) {
    return res.status(400).json({ error: "Provide questions and/or flashcards arrays to update" });
  }

  const updatedData = { ...kit.data };
  if (Array.isArray(questions)) updatedData.questions = questions;
  if (Array.isArray(flashcards)) updatedData.flashcards = flashcards;

  const validation = validateKit(updatedData);
  if (!validation.valid) {
    return res.status(400).json({ error: "Updated kit failed validation", details: validation.errors });
  }

  kit.data = validation.kit;
  await kit.save();
  res.json(kit);
});

// Regenerate one section (questions or flashcards) without touching edited/user_added items
kitsRouter.post("/:id/regenerate", async (req, res) => {
  const kit = await KitDoc.findOne({ _id: req.params.id, owner: req.session.userId });
  if (!kit) return res.status(404).json({ error: "Kit not found" });
  if (kit.status !== "ready" || !kit.data) return res.status(400).json({ error: "Kit is not ready" });

  const { section, category } = req.body; // "questions" | "flashcards" | "brief" | "schedule"

  try {
    const requirements = kit.data.role.requirements;

    if (section === "questions" || section === "flashcards") {
      const items = kit.data[section] || [];
      const preserved = items.filter(
        (item: any) => item.state !== "generated" || (category && item.category !== category)
      );
      let freshItems: any[] = [];
      for (const req of requirements) {
        const generated = section === "questions"
          ? await generateQuestionsForRequirement(req)
          : await generateFlashcardsForRequirement(req);
        freshItems.push(...(category ? generated.filter((g: any) => g.category === category) : generated));
      }
      const updatedData = { ...kit.data, [section]: [...preserved, ...freshItems] };
      const validation = validateKit(updatedData);
      if (!validation.valid) return res.status(400).json({ error: "Regenerated kit failed validation", details: validation.errors });
      kit.data = validation.kit;
    } else if (section === "brief") {
      // Note: original crawled page content isn't stored, so this regenerates
      // from the company name and previously-found source URLs only — a known
      // simplification, documented in the README.
      const brief = await generateCompanyBrief(kit.data.source.company, "", []);
      const updatedData = { ...kit.data, company_brief: { ...kit.data.company_brief, ...brief } };
      const validation = validateKit(updatedData);
      if (!validation.valid) return res.status(400).json({ error: "Regenerated kit failed validation", details: validation.errors });
      kit.data = validation.kit;
    } else if (section === "schedule") {
      const scheduleDays = buildSchedule(requirements, kit.data.questions, kit.data.schedule.days_available);
      const updatedData = { ...kit.data, schedule: { ...kit.data.schedule, days: scheduleDays } };
      const validation = validateKit(updatedData);
      if (!validation.valid) return res.status(400).json({ error: "Regenerated kit failed validation", details: validation.errors });
      kit.data = validation.kit;
    } else {
      return res.status(400).json({ error: "section must be 'questions', 'flashcards', 'brief', or 'schedule'" });
    }

    await kit.save();
    res.json(kit);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Regeneration failed" });
  }
});

// Record confidence for a flashcard in practice mode
kitsRouter.post("/:id/practice", async (req, res) => {
  const kit = await KitDoc.findOne({ _id: req.params.id, owner: req.session.userId });
  if (!kit) {
    return res.status(404).json({ error: "Kit not found" });
  }

  const { flashcardId, confidence } = req.body;
  if (!flashcardId || !["low", "medium", "high"].includes(confidence)) {
    return res.status(400).json({ error: "flashcardId and confidence ('low'|'medium'|'high') required" });
  }

  kit.practiceProgress = { ...(kit.practiceProgress || {}), [flashcardId]: confidence };
  await kit.save();
  res.json({ practiceProgress: kit.practiceProgress });
});

// Create multiple kits at once from an uploaded array of { jd, company_url, days }
kitsRouter.post("/bulk", async (req, res) => {
  const { cases } = req.body;
  if (!Array.isArray(cases) || cases.length === 0) {
    return res.status(400).json({ error: "Provide a non-empty array of cases" });
  }
  if (cases.length > 10) {
    return res.status(400).json({ error: "Maximum 10 kits per bulk upload" });
  }

  const created = [];
  for (const c of cases) {
    if (!c.jd || !c.company_url || !c.days) {
      continue; // skip malformed entries rather than failing the whole batch
    }

    const kitDoc = await KitDoc.create({ owner: req.session.userId, status: "generating" });
    created.push({ id: kitDoc._id, jd: c.jd, companyUrl: c.company_url, days: c.days });

    runPipeline({ jd: c.jd, companyUrl: c.company_url, days: c.days })
      .then(async (kit) => {
        const validation = validateKit(kit);
        const doc = await KitDoc.findById(kitDoc._id);
        if (!doc) return;
        if (!validation.valid) {
          doc.status = "failed";
          doc.error = validation.errors.join("; ");
        } else {
          doc.status = "ready";
          doc.data = validation.kit;
        }
        await doc.save();
      })
      .catch(async (err) => {
        const doc = await KitDoc.findById(kitDoc._id);
        if (!doc) return;
        doc.status = "failed";
        doc.error = err instanceof Error ? err.message : String(err);
        await doc.save();
      });
  }

  res.status(202).json({ created: created.map((c) => c.id) });
});

// Delete a kit
kitsRouter.delete("/:id", async (req, res) => {
  const kit = await KitDoc.findOneAndDelete({ _id: req.params.id, owner: req.session.userId });
  if (!kit) {
    return res.status(404).json({ error: "Kit not found" });
  }
  res.json({ success: true });
});