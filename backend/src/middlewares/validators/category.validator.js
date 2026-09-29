import { z } from "zod";
import { objectId } from "./common.validator.js";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(25, "Max 25 characters"),
  color: z.string().min(1, "Color is required"),
  sectors: z.array(objectId("Invalid sector id")).min(
    1,
    "Category must belong to at least one sector",
  ),
});