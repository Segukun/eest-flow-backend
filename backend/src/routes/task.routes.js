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
  getArchivedTasks,
  restoreTask,
  permanentlyDeleteTask,
  restoreArchivedTasks,
  deleteArchivedTasks,
} from "../controllers/task.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";

import { taskSchema } from "../middlewares/validators/task.validator.js";
import { moveTaskSchema } from "../middlewares/validators/taskMove.validator.js";
import { bulkTaskIdsSchema } from "../middlewares/validators/taskBulk.validator.js";

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

// Archivero: va ANTES de "/:id", si no Express lo toma como un id.
router.get("/archived", authenticate, getArchivedTasks);

// Archivero en lote: restaurar (cualquiera) y eliminar definitivamente (admin).
router.post(
  "/archived/restore",
  authenticate,
  validate(bulkTaskIdsSchema),
  restoreArchivedTasks,
);

router.post(
  "/archived/delete",
  authenticate,
  authorize("admin"),
  validate(bulkTaskIdsSchema),
  deleteArchivedTasks,
);

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

// Archivero: una sola tarea.
router.patch("/:id/restore", authenticate, restoreTask);

router.delete(
  "/:id/permanent",
  authenticate,
  authorize("admin"),
  permanentlyDeleteTask,
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

// Archivado (soft delete) de tareas.
router.delete(
  "/:id",
  authenticate,
  authorize("admin", "collaborator"),
  softDeleteTask,
);

export default router;