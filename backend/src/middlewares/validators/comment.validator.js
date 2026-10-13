import { z } from "zod";
import { objectId } from "./common.validator.js";

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(2000, "Max 2000 characters"),
  parentCommentId: objectId("Invalid parentComment id").nullable().optional(),
});

export const updateCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(2000, "Max 2000 characters"),
});
