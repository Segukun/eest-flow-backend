import { Router } from "express";

import {
  disableUser,
  getUserById,
  getUsers,
  updateUser,
} from "../controllers/user.controller.js";

const router = Router();

router.get("/:id", getUserById);
router.get("/", getUsers);
router.put("/:id", updateUser);
router.delete("/:id", disableUser);

export default router;
