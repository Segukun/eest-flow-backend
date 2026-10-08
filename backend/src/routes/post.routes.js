import { Router } from "express";

import {
  createPost,
  deletePost,
  getPostById,
  getPosts,
  updatePost,
} from "../controllers/post.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { uploadPostFilesMiddleware } from "../middlewares/upload.middleware.js";

const router = Router();

router.get("/", authenticate, getPosts);

router.get("/:id", authenticate, getPostById);

router.post("/", authenticate, uploadPostFilesMiddleware, createPost);

router.put("/:id", authenticate, updatePost);

router.delete("/:id", authenticate, deletePost);

export default router;