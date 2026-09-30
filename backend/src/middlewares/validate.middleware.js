import ApiError from "../utils/apiError.js";

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
  };
}
