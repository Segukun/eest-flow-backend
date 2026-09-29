import { Router } from "express";
import {
  createLabel,
  disableLabel,
  getLabelById,
  getLabels,
  updateLabel,
} from "../controllers/label.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  labelSchema,
  listLabelsSchema,
} from "../middlewares/validators/label.validator.js";

const router = Router();

router.get("/", authenticate, validate(listLabelsSchema, "query"), getLabels);
router.get("/:id", authenticate, getLabelById);

router.post(
  "/",
  authenticate,
  authorize("admin"),
  validate(labelSchema),
  createLabel,
);
router.put("/:id", authenticate, authorize("admin"), updateLabel);
router.delete("/:id", authenticate, authorize("admin"), disableLabel);

export default router;
