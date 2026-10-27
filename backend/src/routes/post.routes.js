import { Router } from "express";

import {
  createPost,
  deletePost,
  getPostById,
  getPosts,
  updatePost,
  pinPost
} from "../controllers/post.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/user.middleware.js";
import { uploadPostFilesMiddleware } from "../middlewares/upload.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createPostSchema,
  updatePostSchema,
} from "../middlewares/validators/post.validator.js";

const router = Router();

router.get("/", authenticate, getPosts);

router.get("/:id", authenticate, getPostById);

router.post(
  "/",
  authenticate,
  uploadPostFilesMiddleware,
  validate(createPostSchema),
  createPost,
);

router.put("/:id", authenticate, validate(updatePostSchema), updatePost);

router.patch("/:id/pin", authenticate, authorize("admin"), pinPost);

router.delete("/:id", authenticate, deletePost);

export default router;
