import { z } from "zod";
import { objectId } from "./common.validator.js";

export const listNotificationsSchema = z.object({
  filter: z.enum(["all", "unread", "system", "forum", "task"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const notificationIdSchema = z.object({
  id: objectId("Invalid notification id"),
});
