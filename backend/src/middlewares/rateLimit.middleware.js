import rateLimit from "express-rate-limit";

// debe usarse DESPUÉS de authenticate: limita por usuario, no por IP
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
