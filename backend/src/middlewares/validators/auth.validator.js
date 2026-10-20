import { z } from "zod";
import { objectId } from "./common.validator.js";

export const accountSchema = z.object({
  name: z.string().min(1, "Name is required").max(30, "Max 30 characters"),
  email: z.string().email().min(1, "Email is required"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(64, "Max 64 characters"),
  sectors: z
    .array(objectId("Invalid sector id"))
    .min(1, "User must belong to at least one sector"),
});

export const loginSchema = z.object({
  email: z.string().email().min(1, "Email is required"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(64, "Max 64 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().min(1, "Email is required"),
});

export const resendCodeSchema = z.object({
  email: z.string().email().min(1, "Email is required"),
});

export const verifyCodeSchema = z.object({
  email: z.string().email().min(1, "Email is required"),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email().min(1, "Email is required"),
  resetToken: z.string().min(1, "Reset token is required"),
  newPassword: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(64, "Max 64 characters"),
});


