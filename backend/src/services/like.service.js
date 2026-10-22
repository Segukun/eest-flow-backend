import mongoose from "mongoose";

import Like from "../models/like.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";
import { safeNotify } from "./notification.service.js";

function validateObjectId(id, fieldName = "id") {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, `Invalid ${fieldName}`);
  }
}

export async function likePost({ postId, userId }) {
  validateObjectId(postId, "postId");
  validateObjectId(userId, "userId");

  const post = await Post.findOne({
    _id: postId,
    active: true,
  }).lean();

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  const session = await mongoose.startSession();

  let created = false;

  try {
    await session.withTransaction(async () => {
      const existingLike = await Like.findOne({
        post: postId,
        user: userId,
      }).session(session);

      if (existingLike) {
        return;
      }

      await Like.create(
        [
          {
            post: postId,
            user: userId,
          },
        ],
        { session },
      );

      await Post.findByIdAndUpdate(
        postId,
        {
          $inc: {
            likesCount: 1,
          },
        },
        { session },
      );

      created = true;
    });
  } finally {
    await session.endSession();
  }

  const updatedPost = await Post.findById(postId)
    .select("likesCount")
    .lean();

  if (!updatedPost) {
    throw new ApiError(404, "Post not found");
  }

  // Notificar únicamente cuando se creó un like nuevo.
  if (created && String(post.author) !== String(userId)) {
    try {
      const liker = await User.findById(userId)
        .select("name")
        .lean();

      await safeNotify({
        recipients: [post.author],
        actorId: userId,
        category: "forum",
        type: "post_like",
        title: `A ${liker?.name ?? "alguien"} le gustó tu publicación`,
        link: "/foro",
        dedupeKey: `post_like:${postId}:${userId}`,
      });
    } catch (error) {
      // Un fallo de notificación no debe impedir que el like
      // se registre correctamente.
      console.error("Error creating post-like notification:", error);
    }
  }

  return {
    liked: true,
    created,
    likesCount: updatedPost.likesCount ?? 0,
  };
}

export async function unlikePost({ postId, userId }) {
  validateObjectId(postId, "postId");
  validateObjectId(userId, "userId");

  const post = await Post.findOne({
    _id: postId,
    active: true,
  }).lean();

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  const session = await mongoose.startSession();

  let removed = false;

  try {
    await session.withTransaction(async () => {
      const result = await Like.deleteOne(
        {
          post: postId,
          user: userId,
        },
        { session },
      );

      if (result.deletedCount === 0) {
        return;
      }

      removed = true;

      await Post.findByIdAndUpdate(
        postId,
        {
          $inc: {
            likesCount: -1,
          },
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  const updatedPost = await Post.findById(postId)
    .select("likesCount")
    .lean();

  if (!updatedPost) {
    throw new ApiError(404, "Post not found");
  }

  return {
    liked: false,
    removed,
    likesCount: updatedPost.likesCount ?? 0,
  };
}