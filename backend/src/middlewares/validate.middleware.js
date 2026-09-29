import ApiError from "../utils/apiError.js";

<<<<<<< HEAD
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map((e) => e.message).join(", ");
      throw new ApiError(400, messages);
    }
    req.body = result.data;
    next();
=======
export function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const messages = result.error.issues.map((e) => e.message).join(", ");
      return next(new ApiError(400, messages));
    }

    if (source !== "query") {
      req[source] = result.data;
    }

    return next();
>>>>>>> 595b41c (Middleware validador de jerarquia.)
  };
}
