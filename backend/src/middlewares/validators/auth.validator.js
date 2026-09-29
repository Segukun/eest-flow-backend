import { z } from "zod";
import { objectId } from "./common.validator.js";

export const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
  sectors: z.array(objectId("Invalid sector id")).min(
    1,
    "User must belong to at least one sector",
  ),
});

export const loginSchema = z.object({
  email: z.string().email().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
  //
});