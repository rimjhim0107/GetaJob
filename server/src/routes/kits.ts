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