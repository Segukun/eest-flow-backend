import { Router } from "express";

import {
  likePost,
  unlikePost,
} from "../controllers/like.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.post(
  "/posts/:postId/like",
  authenticate,
  likePost,
);

router.delete(
  "/posts/:postId/like",
  authenticate,
  unlikePost,
);

export default router;