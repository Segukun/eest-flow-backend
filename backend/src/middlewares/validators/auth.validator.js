import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
  sector: z.enum([
    "student_affairs",
    "secretary_office",
    "school_administration",
    "teachers",
  ]),
});

export const loginSchema = z.object({
  email: z.string().email().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
  //
});
