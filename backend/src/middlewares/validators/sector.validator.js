import { z } from "zod";

export const sectorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(50, "Max 50 characters"),
  description: z.string().trim().max(200, "Max 200 characters").optional(),
  color: z
    .string()
    .trim()
    .max(64, "Max 64 characters")
    .regex(/^(#[0-9A-Fa-f]{3,8}|var\(--[\w-]+\))$/, "Invalid color format"),
});
