import { Router } from "express";
import {
  disableUser,
  getUserById,
  getUsers,
  updateUser,
} from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";

const router = Router();

router.get("/:id", authenticate, getUserById);
router.get("/", authenticate, getUsers);
router.put("/:id", authenticate, updateUser);
router.delete("/:id", authenticate, authorize("admin"), disableUser);

export default router;