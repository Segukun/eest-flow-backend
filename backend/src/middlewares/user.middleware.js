import ApiError from "../utils/apiError.js";

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!allowedRoles.includes(req.user.accountType)) {
      return next(new ApiError(403, "Forbidden"));
    }

    return next();
  };
}
