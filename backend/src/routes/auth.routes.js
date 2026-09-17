import { Router } from "express";
import {
  createAccount,
  login,
  logout,
  refreshToken,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";

const router = Router();

router.post("/login", login);
router.post("/accounts", authenticate, authorize("admin"), createAccount);
router.post("/refresh", authenticate, refreshToken);
router.post("/logout", authenticate, logout);

export default router;
