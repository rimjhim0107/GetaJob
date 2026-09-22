import mongoose from "mongoose";

const KitDocSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "generating", "ready", "failed"], default: "pending" },
  error: { type: String, default: null },
  data: { type: mongoose.Schema.Types.Mixed, default: null },
  practiceProgress: { type: mongoose.Schema.Types.Mixed, default: {} }, // { [flashcardId]: "low" | "medium" | "high" }
}, { timestamps: true });

export const KitDoc = mongoose.model("KitDoc", KitDocSchema);