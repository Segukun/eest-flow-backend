import { z } from "zod";
import { objectId } from "./common.validator.js";

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100, "Max 100 characters"),
  description: z
    .string()
    .max(500, "Max 500 characters")
    .optional(),
  assignedUser: z.array(objectId("Invalid assignedUser id")).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]),
  category: objectId("Invalid category id").nullable().optional(),
  state: z.enum(["pending", "in_progress", "review", "completed"]),
  labels: z.array(objectId("Invalid label id")).optional(),
});