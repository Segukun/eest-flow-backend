import { Router } from "express";

import {
  createAccount,
  login,
  logout,
  refreshToken,
} from "../controllers/auth.controller.js";

const router = Router();

router.post("/login", login);
router.post("/accounts", createAccount);
router.post("/refresh", refreshToken);
router.post("/logout", logout);

export default router;
