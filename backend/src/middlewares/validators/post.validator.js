import { z } from "zod";
import { objectId } from "./common.validator.js";

export const contentBlockSchema = z.object({
  type: z.literal("paragraph").default("paragraph"),
  text: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(5000, "Max 5000 characters"),
});

export const attachmentSchema = z.object({
  type: z.enum(["image", "file"]),
  url: z.string().trim().min(1),
  path: z.string().trim().min(1),
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1),
  size: z.number().min(0),
});

// En multipart/form-data (multer) los campos de texto llegan como string,
// por lo que `content` puede venir como string JSON o como array ya parseado.
const contentArray = (message) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }, z.array(contentBlockSchema).min(1, message));

export const createPostSchema = z.object({
  // opcional: si no viene, el controller usa el primer sector del usuario
  sector: objectId("Invalid sector Id").optional(),
  content: contentArray("Post must contain at least one content block"),
});

export const updatePostSchema = z.object({
  content: contentArray(
    "Post must contain at least one content block",
  ).optional(),
  attachments: z
    .array(attachmentSchema)
    .max(10, "Post cannot contain more than 10 attachments")
    .optional(),
});
