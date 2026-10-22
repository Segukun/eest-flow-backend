import { Router } from "express";
import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from "../controllers/notification.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  listNotificationsSchema,
  notificationIdSchema,
} from "../middlewares/validators/notification.validator.js";

const router = Router();

// "/unread-count" y "/read-all" van antes que "/:id" para que no se confundan con un id
router.get(
  "/",
  authenticate,
  validate(listNotificationsSchema, "query"),
  getNotifications,
);
router.get("/unread-count", authenticate, getUnreadCount);
router.patch("/read-all", authenticate, markAllAsRead);
router.patch(
  "/:id/read",
  authenticate,
  validate(notificationIdSchema, "params"),
  markAsRead,
);

export default router;
