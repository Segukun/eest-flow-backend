import * as postService from "../services/like.service.js";

export async function likePost(req, res, next) {
  try {
    const result = await postService.likePost({
      postId: req.params.postId,
      userId: req.user._id,
    });

    return res.status(200).json({
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function unlikePost(req, res, next) {
  try {
    const result = await postService.unlikePost({
      postId: req.params.postId,
      userId: req.user._id,
    });

    return res.status(200).json({
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}
