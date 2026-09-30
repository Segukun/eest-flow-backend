import mongoose from "mongoose";

import Like from "../models/like.model.js";
import Post from "../models/post.model.js";
import ApiError from "../utils/apiError.js";

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
    });

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