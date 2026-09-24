import { Router } from "express";
import {
  createAccount,
  login,
  logout,
  refreshToken,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  accountSchema,
  loginSchema,
} from "../middlewares/validators/auth.validator.js";

const router = Router();

router.post("/login", validate(loginSchema), login);
router.post(
  "/accounts",
  authenticate,
  authorize("admin"),
  validate(accountSchema),
  createAccount,
);
router.post("/refresh", authenticate, refreshToken);
router.post("/logout", authenticate, logout);

export default router;
