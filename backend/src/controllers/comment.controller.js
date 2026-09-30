import {
  createComment as createCommentService,
  getComments as getCommentsService,
  updateComment as updateCommentService,
  disableComment as disableCommentService,
} from "../services/comment.service.js";

export async function createComment(req, res, next) {
  try {
    const comment = await createCommentService({
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
    const result = await getCommentsService({
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
    const comment = await updateCommentService({
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
    const result = await disableCommentService({
      commentId: req.params.id,
      user: req.user,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}