import { Router } from "express";
import { KitDoc } from "../models/Kit";
import { runPipeline } from "../pipeline/runPipeline";
import { validateKit } from "../schemas/validateKit";

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