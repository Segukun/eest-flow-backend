import { createClient } from "@supabase/supabase-js";

import ApiError from "../utils/apiError.js";

let supabase = null;

// Leer configuración al usar storage, no al importar las rutas del foro.
export function getSupabase() {
  if (supabase) {
    return supabase;
  }

  const missing = ["SUPABASE_URL", "SUPABASE_SECRET_KEY"].filter(
    (name) => !process.env[name]?.trim(),
  );

  if (missing.length > 0) {
    console.error("[storage] Missing configuration:", missing.join(", "));
    throw new ApiError(503, "Storage is not configured");
  }

  try {
    supabase = createClient(
      process.env.SUPABASE_URL.trim(),
      process.env.SUPABASE_SECRET_KEY.trim(),
    );
  } catch {
    // El error del SDK puede contener configuración: no registrar sus valores.
    console.error("[storage] Supabase configuration is invalid");
    throw new ApiError(503, "Storage configuration is invalid");
  }

  return supabase;
}
