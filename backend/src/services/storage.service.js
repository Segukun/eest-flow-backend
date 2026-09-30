import crypto from "crypto";
import path from "path";

import { supabase } from "../config/supabase.js";
import ApiError from "../utils/apiError.js";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET;

if (!BUCKET) {
  throw new Error("SUPABASE_STORAGE_BUCKET is not configured");
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

  const uploadedFiles = [];

  try {
    for (const file of files) {
      const storagePath = createStoragePath(
        postId,
        file.originalname,
      );

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw new ApiError(
          500,
          `Failed to upload file: ${file.originalname}`,
        );
      }

      const { data } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

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

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(paths);

  if (error) {
    throw new ApiError(
      500,
      "Failed to delete files from storage",
    );
  }
}