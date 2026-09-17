import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";

export async function authenticate(req, res, next) {
  try {
    const token = req.cookies.accessToken;
    if (!token) {
      throw new ApiError(401, "Authentication required");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user?.active) {
      throw new ApiError(401, "Invalid authentication");
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}
