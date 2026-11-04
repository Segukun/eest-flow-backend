import { Router } from "express";

import {
  createTask,
  getTasks,
  getTasksById,
  moveTask,
  softDeleteTask,
  updateTask,
  uploadTaskAttachments,
  deleteTaskAttachment,
} from "../controllers/task.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";

import { taskSchema } from "../middlewares/validators/task.validator.js";
import { moveTaskSchema } from "../middlewares/validators/taskMove.validator.js";

import { taskCreateLimiter } from "../middlewares/rateLimit.middleware.js";
import { uploadTaskFilesMiddleware } from "../middlewares/uploadTask.middleware.js";

const router = Router();

// Tareas.
router.post(
  "/",
  authenticate,
  taskCreateLimiter,
  validate(taskSchema),
  createTask,
);

router.get("/", authenticate, getTasks);

router.get("/:id", authenticate, getTasksById);

router.put(
  "/:id",
  authenticate,
  validate(taskSchema.partial()),
  updateTask,
);

router.patch(
  "/:id/move",
  authenticate,
  validate(moveTaskSchema),
  moveTask,
);

// Adjuntos de tareas.
router.post(
  "/:id/attachments",
  authenticate,
  uploadTaskFilesMiddleware,
  uploadTaskAttachments,
);

router.delete(
  "/:id/attachments/:attachmentId",
  authenticate,
  deleteTaskAttachment,
);

// Eliminación de tareas.
router.delete(
  "/:id",
  authenticate,
  authorize("admin", "collaborator"),
  softDeleteTask,
);

export default router;