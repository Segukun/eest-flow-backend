import * as postService from "../services/post.service.js";

import ApiError from "../utils/apiError.js";

export async function createPost(req, res, next) {
  try {
    // el cliente puede elegir el sector; si no lo manda, se usa el primero del usuario
    const sectorId = req.body.sector ?? req.user.sectors?.[0];

    if (!sectorId) {
      return next(
        new ApiError(400, "No sector provided and the user has none assigned"),
      );
    }

    const post = await postService.createPost({
      authorId: req.user._id,
      sectorId,
      content: parseContent(req.body.content),
      files: req.files ?? [],
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
    const result = await postService.getPosts({
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
    const post = await postService.getPostById(req.params.id, req.user._id);

    return res.status(200).json({
      data: post,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updatePost(req, res, next) {
  try {
    const post = await postService.updatePost({
      postId: req.params.id,
      user: req.user,
      content: req.body.content,
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
    const result = await postService.disablePost({
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
      throw new ApiError(
        400,
        "Invalid content JSON",
      );
    }
  }

  return content;
}
