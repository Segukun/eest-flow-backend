import { Router } from "express";
import {
  changePassword,
  createAccount,
  forgotPassword,
  login,
  logout,
  refreshToken,
  resendCode,
  resetPassword,
  verifyCode,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  accountSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resendCodeSchema,
  resetPasswordSchema,
  verifyCodeSchema,
} from "../middlewares/validators/auth.validator.js";

const router = Router();

router.post("/login", validate(loginSchema), login);
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  forgotPassword,
);
router.post("/resend-code", validate(resendCodeSchema), resendCode);
router.post("/verify-code", validate(verifyCodeSchema), verifyCode);
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  resetPassword,
);
router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  changePassword,
);
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
