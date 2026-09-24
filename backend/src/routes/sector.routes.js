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

const router = Router();

router.get("/", authenticate, getSectors);
router.get("/:id", authenticate, getSectorById);
router.get("/:id/members", authenticate, getSectorMembers);

router.post("/", authenticate, authorize("admin"), createSector);
router.put("/:id", authenticate, authorize("admin"), updateSector);
router.delete("/:id", authenticate, authorize("admin"), disableSector);

export default router;