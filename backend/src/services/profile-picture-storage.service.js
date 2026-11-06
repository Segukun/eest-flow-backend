import { randomUUID } from "node:crypto";

import ApiError from "../utils/apiError.js";
import { getSupabase } from "../config/supabase.js";

const PROFILE_BUCKET =
  process.env.SUPABASE_PROFILES_BUCKET || "profiles";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
const SIGNED_URL_REFRESH_MARGIN_MS = 60 * 60 * 1000;

const signedUrlCache = new Map();

const EXTENSIONS_BY_MIME_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Obtiene el almacenamiento de imágenes de perfil.
 */
function getStorage() {
  return getSupabase().storage.from(PROFILE_BUCKET);
}

/**
 * Sube una imagen de perfil a Supabase.
 *
 * Cada imagen se guarda en:
 * users/{userId}/{uuid}.{extension}
 *
 * Devuelve únicamente la ruta del archivo.
 */
export async function uploadProfilePictureFile(userId, file) {
  if (!file?.buffer) {
    throw new ApiError(400, "Select an image to upload");
  }

  const extension = EXTENSIONS_BY_MIME_TYPE[file.mimetype];

  if (!extension) {
    throw new ApiError(415, "Image type not allowed");
  }

  const storage = getStorage();

  const filePath = `users/${userId}/${randomUUID()}.${extension}`;

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
    throw new ApiError(502, "Could not upload profile picture");
  }

  return filePath;
}

/**
 * Genera una URL firmada para mostrar una imagen de perfil.
 *
 * Las URLs se almacenan temporalmente en memoria para evitar
 * generar una nueva URL en cada consulta.
 */
export async function getProfilePictureSignedUrl(filePath) {
  if (!filePath) return null;

  const cached = signedUrlCache.get(filePath);

  if (
    cached &&
    cached.expiresAt - Date.now() > SIGNED_URL_REFRESH_MARGIN_MS
  ) {
    return cached.url;
  }

  const storage = getStorage();

  const { data, error } = await storage.createSignedUrl(
    filePath,
    SIGNED_URL_TTL_SECONDS,
  );

  if (error || !data?.signedUrl) {
    console.error(
      "No se pudo generar la URL firmada de la imagen de perfil:",
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
 * Elimina físicamente una imagen de perfil de Supabase.
 */
export async function deleteProfilePictureFile(filePath) {
  if (!filePath) return;

  const storage = getStorage();

  const { error } = await storage.remove([filePath]);

  signedUrlCache.delete(filePath);

  if (error) {
    throw new ApiError(
      502,
      "Could not delete profile picture from storage",
    );
  }
}