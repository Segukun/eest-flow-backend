import { z } from "zod";
import { objectId } from "./common.validator.js";

export const bulkTaskIdsSchema = z.object({
  ids: z
    .array(objectId("Invalid task id"))
    .min(1, "Select at least one task")
    .max(500, "Too many tasks in a single request"),
});