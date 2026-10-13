import { Router } from "express";

import {
  createComment,
  deleteComment,
  getComments,
  updateComment,
} from "../controllers/comment.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createCommentSchema,
  updateCommentSchema,
} from "../middlewares/validators/comment.validator.js";

const router = Router();

router.get(
  "/posts/:postId/comments",
  authenticate,
  getComments,
);

router.post(
  "/posts/:postId/comments",
  authenticate,
  validate(createCommentSchema),
  createComment,
);

router.put(
  "/comments/:id",
  authenticate,
  validate(updateCommentSchema),
  updateComment,
);

router.delete(
  "/comments/:id",
  authenticate,
  deleteComment,
);

export default router;