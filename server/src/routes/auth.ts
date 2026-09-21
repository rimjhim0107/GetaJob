import { Router } from "express";
import bcrypt from "bcrypt";
import { User } from "../models/User";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash });

  req.session.userId = user._id.toString();
  res.status(201).json({ id: user._id, email: user.email });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  req.session.userId = user._id.toString();
  res.json({ id: user._id, email: user.email });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

authRouter.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in" });
  }
  res.json({ id: req.session.userId });
});