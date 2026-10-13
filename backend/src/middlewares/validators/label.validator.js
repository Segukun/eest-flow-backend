import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const labelSchema = z.object({
  title: z.string().trim().max(30, "Max 30 characters").optional(),
  color: z
    .string()
    .trim()
    .min(1, "Color is required")
    .regex(/^(#[0-9A-Fa-f]{3,8}|var\(--[\w-]+\))$/, "Invalid color format"),
  category: z.string().regex(objectIdRegex, "Invalid category id"),
});

export const listLabelsSchema = z.object({
  category: z.string().regex(objectIdRegex, "Invalid category id"),
});
