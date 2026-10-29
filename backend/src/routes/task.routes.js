import { Router } from "express";

import {
  createTask,
  getTasks,
  getTasksById,
  moveTask,
  softDeleteTask,
  updateTask,
} from "../controllers/task.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { taskSchema } from "../middlewares/validators/task.validator.js";
import { moveTaskSchema } from "../middlewares/validators/taskMove.validator.js";
import { taskCreateLimiter } from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.post("/", authenticate, taskCreateLimiter, validate(taskSchema), createTask);
router.get("/", authenticate, getTasks);
router.get("/:id", authenticate, getTasksById);
router.put("/:id", authenticate, validate(taskSchema.partial()), updateTask);
router.patch("/:id/move", authenticate, validate(moveTaskSchema), moveTask);
router.delete(
  "/:id",
  authenticate,
  authorize("admin", "collaborator"),
  softDeleteTask,
);

export default router;