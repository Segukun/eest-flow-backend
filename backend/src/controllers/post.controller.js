import {
  createPost as createPostService,
  getPosts as getPostsService,
  getPostById as getPostByIdService,
  updatePost as updatePostService,
  disablePost as disablePostService,
} from "../services/post.service.js";

import ApiError from "../utils/apiError.js";

export async function createPost(req, res, next) {
  try {
    const post = await createPostService({
      authorId: req.user._id,
      sectorId: req.body.sectorId,
      content: parseContent(req.body.content),
      files: req.files,
    });

    return res.status(201).json({
      message: "Post created successfully",
      data: post,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPosts(req, res, next) {
  try {
    const result = await getPostsService({
      page: req.query.page,
      limit: req.query.limit,
      sectorId: req.query.sectorId,
      userId: req.user._id,
    });

    return res.status(200).json({
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPostById(req, res, next) {
  try {
    const post = await getPostByIdService(
      req.params.id,
      req.user._id,
    );

    return res.status(200).json({
      data: post,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updatePost(req, res, next) {
  try {
    const post = await updatePostService({
      postId: req.params.id,
      user: req.user,
      content: req.body.content,
      attachments: req.body.attachments,
    });

    return res.status(200).json({
      message: "Post updated successfully",
      data: post,
    });
  } catch (error) {
    return next(error);
  }
}

export async function deletePost(req, res, next) {
  try {
    const result = await disablePostService({
      postId: req.params.id,
      user: req.user,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

function parseContent(content) {
  if (typeof content === "string") {
    try {
      return JSON.parse(content);
    } catch {
      throw new ApiError(400, "Invalid content JSON");
    }
  }

  return content;
}