import * as commentService from "../services/comment.service.js";

export async function createComment(req, res, next) {
  try {
    const comment = await commentService.createComment({
      postId: req.params.postId,
      authorId: req.user._id,
      content: req.body.content,
      parentCommentId: req.body.parentCommentId,
    });

    return res.status(201).json({
      message: "Comment created successfully",
      data: comment,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getComments(req, res, next) {
  try {
    const result = await commentService.getComments({
      postId: req.params.postId,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateComment(req, res, next) {
  try {
    const comment = await commentService.updateComment({
      commentId: req.params.id,
      user: req.user,
      content: req.body.content,
    });

    return res.status(200).json({
      message: "Comment updated successfully",
      data: comment,
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteComment(req, res, next) {
  try {
    const result = await commentService.disableComment({
      commentId: req.params.id,
      user: req.user,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}
