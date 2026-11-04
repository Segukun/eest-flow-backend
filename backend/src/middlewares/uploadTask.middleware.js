import multer from "multer";
import ApiError from "../utils/apiError.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const fileFilter = (req, file, callback) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return callback(
      new ApiError(415, `File type not allowed: ${file.mimetype}`),
      false,
    );
  }

  callback(null, true);
};

export const uploadTaskFilesMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
  fileFilter,
}).array("files", MAX_FILES);