import ApiError from "../utils/apiError.js";

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map((e) => e.message).join(", ");
      throw new ApiError(400, messages);
    }
    req.body = result.data;
    next();
  };
}
