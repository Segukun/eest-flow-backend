import { Router } from "express";

import {
  disableUser,
  getUserById,
  getUsers,
  updateUser,
  uploadProfilePicture,
  deleteProfilePicture,
} from "../controllers/user.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";

import { uploadProfilePictureMiddleware } from "../middlewares/uploadProfilePicture.middleware.js";

import { updateUserSchema } from "../middlewares/validators/user.validator.js";

const router = Router();

router.get("/:id", authenticate, getUserById);
router.get("/", authenticate, getUsers);

// Imagen de perfil
router.put(
  "/:id/profile-picture",
  authenticate,
  uploadProfilePictureMiddleware,
  uploadProfilePicture,
);

router.delete(
  "/:id/profile-picture",
  authenticate,
  deleteProfilePicture,
);

// Actualización de datos del usuario
router.put(
  "/:id",
  authenticate,
  validate(updateUserSchema.partial()),
  updateUser,
);

router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  disableUser,
);

export default router;