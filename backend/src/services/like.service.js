import mongoose from "mongoose";

import Like from "../models/like.model.js";
import Post from "../models/post.model.js";
import ApiError from "../utils/apiError.js";
import { safeNotify } from "./notification.service.js";

function validateObjectId(id, fieldName = "id") {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, `Invalid ${fieldName}`);
  }
}

export async function likePost({
  postId,
  userId,
}) {
  validateObjectId(postId, "postId");
  validateObjectId(userId, "userId");

  const post = await Post.findOne({
    _id: postId,
    active: true,
  });

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

    // Solo se notifica cuando el like es nuevo (no en el no-op idempotente). Fuera de la transacción y sin lanzar: notificar no debe romper el like.
    if (created) {
      const excerpt = (post.content ?? [])
        .map((block) => block.text ?? "")
        .join(" ")
        .trim()
        .slice(0, 120);

      await safeNotify({
        recipients: [post.author],
        actorId: userId,
        post: postId,
        category: "forum",
        type: "post_like",
        title: "A alguien le gustó tu publicación",
        description: excerpt,
        link: `/foro?post=${postId}`,
        // Un solo aviso de like por persona y publicación, aunque se quite y se vuelva a dar.
        dedupeKey: `like:${postId}:${userId}`,
      });
    }

    const updatedPost = await Post.findById(postId)
      .select("likesCount")
      .lean();

    return {
      liked: true,
      likesCount: updatedPost.likesCount,
    };
  } finally {
    await session.endSession();
  }
}

export async function unlikePost({
  postId,
  userId,
}) {
  validateObjectId(postId, "postId");
  validateObjectId(userId, "userId");

  const post = await Post.findOne({
    _id: postId,
    active: true,
  });

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  const session = await mongoose.startSession();

  try {
    let removed = false;

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

    const updatedPost = await Post.findById(postId)
      .select("likesCount")
      .lean();

    return {
      liked: false,
      removed,
      likesCount: updatedPost.likesCount,
    };
  } finally {
    await session.endSession();
  }
}
