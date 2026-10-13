import { Router } from "express";
import {
  createSector,
  disableSector,
  getSectorById,
  getSectorMembers,
  getSectors,
  updateSector,
} from "../controllers/sector.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { sectorSchema } from "../middlewares/validators/sector.validator.js";

const router = Router();

router.get("/", authenticate, getSectors);
router.get("/:id", authenticate, getSectorById);
router.get("/:id/members", authenticate, getSectorMembers);

router.post(
  "/",
  authenticate,
  authorize("admin"),
  validate(sectorSchema),
  createSector,
);
router.put(
  "/:id",
  authenticate,
  authorize("admin"),
  validate(sectorSchema.partial()),
  updateSector,
);
router.delete("/:id", authenticate, authorize("admin"), disableSector);

export default router;
