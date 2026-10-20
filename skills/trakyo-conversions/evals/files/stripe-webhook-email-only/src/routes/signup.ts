import type { Request, Response } from "express";
import { db } from "../db";

/**
 * POST /signup — the "Get the free training" form on www.acme-coaching.com.
 * The form posts name, email and a few hidden fields the marketing site adds.
 */
export async function signup(req: Request, res: Response) {
  const { email, name } = req.body as { email?: string; name?: string };
  if (!email) return res.status(400).json({ error: "email required" });

  const user = await db.users.upsert({ email, name: name ?? null });
  res.redirect(303, "/welcome");
}
