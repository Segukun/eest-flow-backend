import mongoose from "mongoose";

import Comment from "../models/comment.model.js";
import Post from "../models/post.model.js";
import ApiError from "../utils/apiError.js";
import { safeNotify } from "./notification.service.js";

function validateObjectId(id, fieldName = "id") {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, `Invalid ${fieldName}`);
  }
}

function canModifyComment(comment, user) {
  return (
    user.accountType === "admin" ||
    String(comment.author) === String(user._id)
  );
}

export async function createComment({
  postId,
  authorId,
  content,
  parentCommentId = null,
}) {
  validateObjectId(postId, "postId");
  validateObjectId(authorId, "authorId");

  const text = content?.trim();

  if (!text) {
    throw new ApiError(400, "Comment content is required");
  }

  const post = await Post.findOne({
    _id: postId,
    active: true,
  });

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  let parentComment = null;

  if (parentCommentId) {
    validateObjectId(parentCommentId, "parentCommentId");

    parentComment = await Comment.findOne({
      _id: parentCommentId,
      post: postId,
      active: true,
    });

    if (!parentComment) {
      throw new ApiError(404, "Parent comment not found");
    }
  }

  const session = await mongoose.startSession();

  try {
    let comment;

    await session.withTransaction(async () => {
      [comment] = await Comment.create(
        [
          {
            post: postId,
            author: authorId,
            content: text,
            parentComment: parentCommentId,
          },
        ],
        { session },
      );

      await Post.findByIdAndUpdate(
        postId,
        {
          $inc: {
            commentsCount: 1,
          },
        },
        { session },
      );
    });

    const excerpt = text.length > 120 ? `${text.slice(0, 120)}...` : text;

    // Se notifica fuera de la transacción y sin lanzar: un fallo al notificar no debe deshacer un comentario que ya se guardó.
    if (parentComment) {
      await safeNotify({
        recipients: [parentComment.author],
        actorId: authorId,
        post: postId,
        category: "forum",
        type: "comment_reply",
        title: "Respondieron a tu comentario",
        description: excerpt,
        link: `/foro?post=${postId}`,
      });
    } else {
      await safeNotify({
        recipients: [post.author],
        actorId: authorId,
        post: postId,
        category: "forum",
        type: "post_comment",
        title: "Nuevo comentario en tu publicación",
        description: excerpt,
        link: `/foro?post=${postId}`,
      });
    }

    return await Comment.findById(comment._id)
      .populate("author", "name email accountType")
      .populate("parentComment")
      .lean();
  } finally {
    await session.endSession();
  }
}

export async function getComments({
  postId,
  page = 1,
  limit = 20,
}) {
  validateObjectId(postId, "postId");

  page = Math.max(Number(page) || 1, 1);
  limit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  const postExists = await Post.exists({
    _id: postId,
    active: true,
  });

  if (!postExists) {
    throw new ApiError(404, "Post not found");
  }

  const filter = {
    post: postId,
    active: true,
  };

  const skip = (page - 1) * limit;

  const [comments, total] = await Promise.all([
    Comment.find(filter)
      .populate("author", "name email accountType")
      .populate("parentComment", "author content")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Comment.countDocuments(filter),
  ]);

  return {
    comments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function updateComment({
  commentId,
  user,
  content,
}) {
  validateObjectId(commentId, "commentId");

  const comment = await Comment.findOne({
    _id: commentId,
    active: true,
  });

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (!canModifyComment(comment, user)) {
    throw new ApiError(403, "You cannot modify this comment");
  }

  const text = content?.trim();

  if (!text) {
    throw new ApiError(400, "Comment content is required");
  }

  comment.content = text;

  await comment.save();

  return await Comment.findById(comment._id)
    .populate("author", "name email accountType")
    .lean();
}

export async function disableComment({
  commentId,
  user,
}) {
  validateObjectId(commentId, "commentId");

  const comment = await Comment.findOne({
    _id: commentId,
    active: true,
  });

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (!canModifyComment(comment, user)) {
    throw new ApiError(403, "You cannot delete this comment");
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const result = await Comment.updateOne(
        {
          _id: commentId,
          active: true,
        },
        {
          $set: {
            active: false,
          },
        },
        { session },
      );

      if (result.modifiedCount !== 1) {
        throw new ApiError(400, "Comment could not be deleted");
      }

      await Post.findByIdAndUpdate(
        comment.post,
        {
          $inc: {
            commentsCount: -1,
          },
        },
        { session },
      );
    });

    return {
      message: "Comment deleted successfully",
    };
  } finally {
    await session.endSession();
  }
}
