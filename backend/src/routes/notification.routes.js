import { Router } from "express";
import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from "../controllers/notification.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// "/unread-count" y "/read-all" van antes que "/:id" para que no se confundan con un id
router.get("/", authenticate, getNotifications);
router.get("/unread-count", authenticate, getUnreadCount);
router.patch("/read-all", authenticate, markAllAsRead);
router.patch("/:id/read", authenticate, markAsRead);

export default router;
