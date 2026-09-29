import ApiError from "../utils/apiError.js";

const STATUS_BY_ERROR_NAME = {
  CastError: 400,
  ValidationError: 400,
  StrictModeError: 400,
};

const DUPLICATE_KEY_CODE = 11000;

function resolveStatusCode(err) {
  if (err instanceof ApiError || err.statusCode) return err.statusCode;
  if (err.code === DUPLICATE_KEY_CODE) return 409;
  return STATUS_BY_ERROR_NAME[err.name] ?? 500;
}

function resolveMessage(err, statusCode) {
  if (statusCode >= 500) return "Internal server error";
  if (err.code === DUPLICATE_KEY_CODE) return "Resource already exists";
  return err.message || "Bad request";
}

export function errorHandler(err, req, res, next) {
  const statusCode = resolveStatusCode(err);

  if (statusCode >= 500) {
    console.error(err);
  }

  return res.status(statusCode).json({
    message: resolveMessage(err, statusCode),
  });
}

export function notFoundHandler(req, res) {
  return res.status(404).json({ message: "Route not found" });
}
