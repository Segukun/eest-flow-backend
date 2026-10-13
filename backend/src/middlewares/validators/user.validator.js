import { z } from "zod";
import { objectId } from "./common.validator.js";

export const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(30, "Max 30 characters"),
  email: z.string().email("Invalid email"),
  sectors: z
    .array(objectId("Invalid sector id"))
    .min(1, "User must belong to at least one sector"),
  accountType: z.enum(["admin", "collaborator"]),
});
