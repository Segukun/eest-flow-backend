import { Router } from "express";
import {
  disableUser,
  getUserById,
  getUsers,
  updateUser,
} from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateUserSchema } from "../middlewares/validators/user.validator.js";

const router = Router();

router.get("/:id", authenticate, getUserById);
router.get("/", authenticate, getUsers);
router.put(
  "/:id",
  authenticate,
  validate(updateUserSchema.partial()),
  updateUser,
);
router.delete("/:id", authenticate, authorize("admin"), disableUser);

export default router;