import { Router } from "express";
import {
  createCategory,
  getCategories,
  getCategoryById,
  softDeleteCategory,
  updateCategory,
} from "../controllers/category.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { categorySchema } from "../middlewares/validators/category.validator.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("admin"),
  validate(categorySchema),
  createCategory,
);
router.get("/", authenticate, getCategories);
router.get("/:id", authenticate, getCategoryById);
router.put("/:id", authenticate, updateCategory);
router.delete("/:id", authenticate, authorize("admin"), softDeleteCategory);

export default router;
