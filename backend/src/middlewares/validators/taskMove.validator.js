import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const moveTaskSchema = z.object({
  state: z.enum(["pending", "in_progress", "review", "completed"]),
  // null o ausente = al final de la columna
  beforeId: objectId.nullable().optional(),
});