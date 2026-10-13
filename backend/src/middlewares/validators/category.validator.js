import { z } from "zod";
import { objectId } from "./common.validator.js";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(25, "Max 25 characters"),
  color: z
    .string()
    .trim()
    .min(1, "Color is required")
    .regex(/^(#[0-9A-Fa-f]{3,8}|var\(--[\w-]+\))$/, "Invalid color format"),
  sectors: z
    .array(objectId("Invalid sector id"))
    .min(1, "Category must belong to at least one sector"),
});
