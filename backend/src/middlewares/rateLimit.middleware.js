
import rateLimit from "express-rate-limit";

// Debe usarse DESPUÉS de authenticate: limita por usuario, no por IP.
const createLimiter = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user._id),
    message: { message },
  });

export const taskCreateLimiter = createLimiter({
  windowMs: 10_000,
  limit: 10,
  message: "Estás creando tareas demasiado rápido. Esperá unos segundos.",
});

export const postCreateLimiter = createLimiter({
  windowMs: 15_000,
  limit: 3,
  message: "Estás publicando demasiado rápido. Esperá unos segundos.",
});

export const sectorJoinRequestLimiter = createLimiter({
  windowMs: 10 * 60_000,
  limit: 8,
  message:
    "Estás enviando solicitudes de acceso demasiado rápido. Intentá más tarde.",
});

export const sectorMembershipLimiter = createLimiter({
  windowMs: 60_000,
  limit: 10,
  message:
    "Estás realizando demasiados cambios de sector. Intentá más tarde.",
});
