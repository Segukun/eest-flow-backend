import mongoose from "mongoose";

import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Like from "../models/like.model.js";
import ApiError from "../utils/apiError.js";

import {
  deleteStorageFiles,
  uploadPostFiles,
} from "./storage.service.js";

function validateObjectId(id, fieldName = "id") {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, `Invalid ${fieldName}`);
  }
}

function normalizeContent(content) {
  if (!Array.isArray(content) || content.length === 0) {
    throw new ApiError(400, "Post content is required");
  }

  return content.map((block) => {
    if (typeof block === "string") {
      const text = block.trim();

      if (!text) {
        throw new ApiError(400, "Post paragraphs cannot be empty");
      }

      return {
        type: "paragraph",
        text,
      };
    }

    if (
      !block ||
      block.type !== "paragraph" ||
      typeof block.text !== "string"
    ) {
      throw new ApiError(400, "Invalid post content");
    }

    const text = block.text.trim();

    if (!text) {
      throw new ApiError(400, "Post paragraphs cannot be empty");
    }

    return {
      type: "paragraph",
      text,
    };
  });
}

async function validateUserSector(userId, sectorId) {
  const user = await User.findOne({
    _id: userId,
    active: true,
    sectors: sectorId,
  });

  if (!user) {
    throw new ApiError(
      403,
      "User does not belong to the selected sector",
    );
  }
}

function canModifyPost(post, user) {
  return (
    user.accountType === "admin" ||
    String(post.author) === String(user._id)
  );
}

export async function createPost({
  authorId,
  sectorId,
  content,
  files = [],
}) {
  validateObjectId(authorId, "authorId");
  validateObjectId(sectorId, "sectorId");

  await validateUserSector(authorId, sectorId);

  const normalizedContent = normalizeContent(content);

  // Generamos el ID antes porque lo vamos a usar
  // como carpeta en Supabase.
  const postId = new mongoose.Types.ObjectId();

  let attachments = [];

  try {
    attachments = await uploadPostFiles(
      postId,
      files,
    );

    const post = await Post.create({
      _id: postId,
      author: authorId,
      sector: sectorId,
      content: normalizedContent,
      attachments,
    });

    return await Post.findById(post._id)
      .populate(
        "author",
        "name email accountType",
      )
      .populate("sector");
  } catch (error) {
    // Si Mongo falla después de subir archivos,
    // eliminamos los archivos de Supabase.
    if (attachments.length > 0) {
      try {
        await deleteStorageFiles(
          attachments.map((file) => file.path),
        );
      } catch (cleanupError) {
        console.error(
          "Storage cleanup failed:",
          cleanupError,
        );
      }
    }

    throw error;
  }
}

export async function getPosts({
  page = 1,
  limit = 10,
  sectorId,
  userId,
}) {
  page = Math.max(Number(page) || 1, 1);
  limit = Math.min(Math.max(Number(limit) || 10, 1), 50);

  const filter = {
    active: true,
  };

  if (sectorId) {
    validateObjectId(sectorId, "sectorId");
    filter.sector = sectorId;
  }

  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .populate("author", "name email accountType")
      .populate("sector")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Post.countDocuments(filter),
  ]);

  let likedPostIds = new Set();

  if (userId && posts.length > 0) {
    const likes = await Like.find({
      user: userId,
      post: {
        $in: posts.map((post) => post._id),
      },
    })
      .select("post")
      .lean();

    likedPostIds = new Set(
      likes.map((like) => String(like.post)),
    );
  }

  const postsWithLikeState = posts.map((post) => ({
    ...post,
    isLiked: likedPostIds.has(String(post._id)),
  }));

  return {
    posts: postsWithLikeState,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getPostById(postId, userId) {
  validateObjectId(postId, "postId");

  const post = await Post.findOne({
    _id: postId,
    active: true,
  })
    .populate("author", "name email accountType")
    .populate("sector")
    .lean();

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  let isLiked = false;

  if (userId) {
    isLiked = Boolean(
      await Like.exists({
        post: postId,
        user: userId,
      }),
    );
  }

  return {
    ...post,
    isLiked,
  };
}

export async function updatePost({
  postId,
  user,
  content,
  attachments,
}) {
  validateObjectId(postId, "postId");

  const post = await Post.findOne({
    _id: postId,
    active: true,
  });

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  if (!canModifyPost(post, user)) {
    throw new ApiError(403, "You cannot modify this post");
  }

  if (content !== undefined) {
    post.content = normalizeContent(content);
  }

  if (attachments !== undefined) {
    post.attachments = attachments;
  }

  await post.save();

  return await Post.findById(post._id)
    .populate("author", "name email accountType")
    .populate("sector");
}

export async function disablePost({ postId, user }) {
  validateObjectId(postId, "postId");

  const post = await Post.findOne({
    _id: postId,
    active: true,
  });

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  if (!canModifyPost(post, user)) {
    throw new ApiError(403, "You cannot delete this post");
  }

  post.active = false;
  await post.save();

  return {
    message: "Post deleted successfully",
  };
}