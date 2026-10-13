import multer from "multer";

import ApiError from "../utils/apiError.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new ApiError(415, `File type not allowed: ${file.mimetype}`),
      false,
    );
  }

  cb(null, true);
};

export const uploadPostFilesMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10,
  },
  fileFilter,
}).array("files", 10);
