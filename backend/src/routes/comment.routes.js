import { Router } from "express";

import {
  createComment,
  deleteComment,
  getComments,
  updateComment,
} from "../controllers/comment.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.get(
  "/posts/:postId/comments",
  authenticate,
  getComments,
);

router.post(
  "/posts/:postId/comments",
  authenticate,
  createComment,
);

router.put(
  "/comments/:id",
  authenticate,
  updateComment,
);

router.delete(
  "/comments/:id",
  authenticate,
  deleteComment,
);

export default router;