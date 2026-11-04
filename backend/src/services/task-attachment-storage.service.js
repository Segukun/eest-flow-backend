import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import path from "node:path";
import ApiError from "../utils/apiError.js";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
const SIGNED_URL_REFRESH_MARGIN_MS = 60 * 60 * 1000;

const signedUrlCache = new Map();

let supabaseClient;

function getStorage() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const bucket = process.env.SUPABASE_TASKS_BUCKET || "task-attachments";

  if (!url || !serviceKey) {
    throw new ApiError(
      500,
      "Task attachments storage is not configured. Check SUPABASE_URL and SUPABASE_SECRET_KEY.",
    );
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return {
    storage: supabaseClient.storage.from(bucket),
    bucket,
  };
}

function sanitizeFileName(originalName) {
  const baseName = path.basename(originalName || "archivo");

  const safeName = baseName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(-120);

  return safeName || "archivo";
}

/**
 * Sube múltiples archivos a Supabase Storage.
 *
 * Cada archivo se guarda en:
 * tasks/{taskId}/{uuid}-{filename}
 */
export async function uploadTaskFiles(taskId, files = []) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new ApiError(400, "Select at least one file to upload");
  }

  const { storage } = getStorage();

  const uploaded = [];

  try {
    for (const file of files) {
      const filePath = `tasks/${taskId}/${randomUUID()}-${sanitizeFileName(file.originalname)}`;

      const { error } = await storage.upload(
        filePath,
        file.buffer,
        {
          contentType: file.mimetype,
          cacheControl: "3600",
          upsert: false,
        },
      );

      if (error) {
        throw new ApiError(
          502,
          `Could not upload ${file.originalname}`,
        );
      }

      uploaded.push({
        originalName: file.originalname,
        path: filePath,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date(),
      });
    }

    return uploaded;
  } catch (error) {
    // Si falla una subida intermedia, eliminamos los archivos
    // que ya se habían subido correctamente.
    const uploadedPaths = uploaded.map((file) => file.path);

    if (uploadedPaths.length) {
      const { error: cleanupError } = await storage.remove(uploadedPaths);

      if (cleanupError) {
        console.error(
          "No se pudieron limpiar archivos tras fallar una subida:",
          cleanupError,
        );
      }
    }

    throw error;
  }
}

/**
 * Genera una URL firmada para acceder a un archivo privado.
 *
 * Las URLs se guardan temporalmente en memoria para evitar
 * crear una URL nueva en cada consulta del tablero.
 */
export async function getTaskFileSignedUrl(filePath) {
  if (!filePath) return null;

  const cached = signedUrlCache.get(filePath);

  if (
    cached &&
    cached.expiresAt - Date.now() > SIGNED_URL_REFRESH_MARGIN_MS
  ) {
    return cached.url;
  }

  const { storage } = getStorage();

  const { data, error } = await storage.createSignedUrl(
    filePath,
    SIGNED_URL_TTL_SECONDS,
  );

  if (error || !data?.signedUrl) {
    console.error(
      "No se pudo generar la URL firmada del adjunto:",
      error,
    );

    return null;
  }

  signedUrlCache.set(filePath, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  });

  return data.signedUrl;
}

/**
 * Elimina físicamente un archivo de Supabase Storage.
 */
export async function deleteTaskStoredFile(filePath) {
  if (!filePath) return;

  const { storage } = getStorage();

  const { error } = await storage.remove([filePath]);

  signedUrlCache.delete(filePath);

  if (error) {
    throw new ApiError(
      502,
      "Could not delete the attachment from storage",
    );
  }
}