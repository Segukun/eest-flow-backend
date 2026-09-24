import { Router } from "express";

import {
  createTask,
  getTasks,
  getTasksById,
  softDeleteTask,
  updateTask,
} from "../controllers/task.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { taskSchema } from "../middlewares/validators/task.validator.js";

const router = Router();

router.post("/", validate(taskSchema), authenticate, createTask);
router.get("/", authenticate, getTasks);
router.get("/:id", authenticate, getTasksById);
router.put("/:id", authenticate, updateTask);
router.delete("/:id", authenticate, authorize("admin"), softDeleteTask);

export default router;
