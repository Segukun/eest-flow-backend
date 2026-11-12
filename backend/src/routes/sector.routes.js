
import { Router } from "express";

import {
  createSector,
  disableSector,
  getSectorById,
  getSectorMembers,
  getSectors,
  updateSector,
  joinSector,
  leaveSector,
  getMyPendingJoinRequests,
  cancelJoinRequest,
  resolveJoinRequest,
} from "../controllers/sector.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";

import {
  sectorJoinRequestLimiter,
  sectorMembershipLimiter,
} from "../middlewares/rateLimit.middleware.js";

import { sectorSchema } from "../middlewares/validators/sector.validator.js";

import {
  resolveSectorJoinRequestSchema,
} from "../middlewares/validators/sectorJoinRequest.validator.js";

const router = Router();

router.use(authenticate);

// Solicitudes: rutas fijas antes de "/:id".
router.get("/requests/mine", getMyPendingJoinRequests);

router.delete("/requests/:requestId", cancelJoinRequest);

router.patch(
  "/requests/:requestId/resolve",
  authorize("admin"),
  validate(resolveSectorJoinRequestSchema),
  resolveJoinRequest,
);

// Sectores.
router.get("/", getSectors);
router.get("/:id", getSectorById);
router.get("/:id/members", getSectorMembers);

// Membresía.
router.post(
  "/:id/join",
  sectorJoinRequestLimiter,
  joinSector,
);

router.post(
  "/:id/leave",
  sectorMembershipLimiter,
  leaveSector,
);

// Administración.
router.post(
  "/",
  authorize("admin"),
  validate(sectorSchema),
  createSector,
);

router.put(
  "/:id",
  authorize("admin"),
  validate(sectorSchema.partial()),
  updateSector,
);

router.delete(
  "/:id",
  authorize("admin"),
  disableSector,
);

export default router;
