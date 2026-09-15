import { Router } from "express";

import {
  createTask,
  getTasks,
  getTasksById,
  softDeleteTask,
  updateTask,
} from "../controllers/task.controller.js";

const router = Router();

router.post("/", createTask);
router.get("/", getTasks);
router.get("/:id", getTasksById);
router.put("/:id", updateTask);
router.delete("/:id", softDeleteTask);

export default router;
