import { Router } from "express";
import { KitDoc } from "../models/Kit";
import { runPipeline } from "../pipeline/runPipeline";
import { validateKit } from "../schemas/validateKit";
import { generateQuestionsForRequirement } from "../pipeline/generateQuestions";
import { generateFlashcardsForRequirement } from "../pipeline/generateFlashcards";

export const kitsRouter = Router();

// Create a kit — starts generation in the background, returns immediately
kitsRouter.post("/", async (req, res) => {
  const { jd, companyUrl, days } = req.body;
  if (!jd || !companyUrl || !days) {
    return res.status(400).json({ error: "jd, companyUrl, and days are required" });
  }

  const kitDoc = await KitDoc.create({
    owner: req.session.userId,
    status: "generating",
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
  if (!kit) {
    return res.status(404).json({ error: "Kit not found" });
  }
  if (kit.status !== "ready" || !kit.data) {
    return res.status(400).json({ error: "Kit is not ready" });
  }

  const { section } = req.body; // "questions" | "flashcards"
  if (section !== "questions" && section !== "flashcards") {
    return res.status(400).json({ error: "section must be 'questions' or 'flashcards'" });
  }

  try {
    const requirements = kit.data.role.requirements;
    const preserved = kit.data[section].filter((item: any) => item.state !== "generated");

    let freshItems: any[] = [];
    for (const req of requirements) {
      const generated = section === "questions"
        ? await generateQuestionsForRequirement(req)
        : await generateFlashcardsForRequirement(req);
      freshItems.push(...generated);
    }

    const updatedData = { ...kit.data, [section]: [...preserved, ...freshItems] };
    const validation = validateKit(updatedData);
    if (!validation.valid) {
      return res.status(400).json({ error: "Regenerated kit failed validation", details: validation.errors });
    }

    kit.data = validation.kit;
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