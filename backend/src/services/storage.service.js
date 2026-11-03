import crypto from "crypto";
import path from "path";

import { getSupabase } from "../config/supabase.js";
import ApiError from "../utils/apiError.js";

function getPostStorage() {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();

  if (!bucket) {
    console.error("[storage] SUPABASE_STORAGE_BUCKET is not configured");
    throw new ApiError(503, "Storage is not configured");
  }

  return { storage: getSupabase().storage.from(bucket), bucket };
}

function getAttachmentType(mimeType) {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  return "file";
}

function getExtension(originalName) {
  return path.extname(originalName).toLowerCase();
}

function createStoragePath(postId, originalName) {
  const extension = getExtension(originalName);
  const uniqueName = `${crypto.randomUUID()}${extension}`;

  return `posts/${postId}/${uniqueName}`;
}

export async function uploadPostFiles(postId, files = []) {
  if (!files.length) {
    return [];
  }

  const { storage, bucket } = getPostStorage();
  const uploadedFiles = [];

  try {
    for (const file of files) {
      const storagePath = createStoragePath(
        postId,
        file.originalname,
      );

      const { error } = await storage.upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        console.error("[storage] upload failed:", {
          bucket,
          path: storagePath,
          file: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          code: error.code,
          message: error.message,
        });
        throw new ApiError(
          500,
          `Failed to upload file: ${file.originalname}`,
        );
      }

      const { data } = storage.getPublicUrl(storagePath);

      uploadedFiles.push({
        type: getAttachmentType(file.mimetype),
        url: data.publicUrl,
        path: storagePath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      });
    }

    return uploadedFiles;
  } catch (error) {
    if (uploadedFiles.length > 0) {
      await deleteStorageFiles(
        uploadedFiles.map((file) => file.path),
      );
    }

    throw error;
  }
}

export async function deleteStorageFiles(paths = []) {
  if (!paths.length) {
    return;
  }

  const { storage, bucket } = getPostStorage();
  const { error } = await storage.remove(paths);

  if (error) {
    console.error("[storage] delete failed:", {
      bucket,
      paths,
      code: error.code,
      message: error.message,
    });
    throw new ApiError(
      500,
      "Failed to delete files from storage",
    );
  }
}
