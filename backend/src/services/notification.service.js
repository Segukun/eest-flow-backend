import Notification from "../models/notification.model.js";
import ApiError from "../utils/apiError.js";

// Crea una notificación por cada destinatario (sin duplicados y sin notificar al autor de la acción). Lo usan los demás services.
export const notifyUsers = async ({
  recipients = [],
  actorId = null,
  post = null,
  category,
  type,
  title,
  description = "",
  link = "",
  dedupeKey,
}) => {
  const ids = [...new Set(recipients.filter(Boolean).map(String))].filter(
    (id) => id !== String(actorId),
  );
  if (ids.length === 0) return [];

  const docs = ids.map((recipient) => ({
    recipient,
    actor: actorId,
    post,
    category,
    type,
    title,
    description,
    link,
    ...(dedupeKey ? { dedupeKey } : {}),
  }));

  // ordered:false -> si algún dedupeKey ya existe, ignora ese y sigue con el resto
  try {
    return await Notification.insertMany(docs, { ordered: false });
  } catch (error) {
    if (error.code === 11000 || error.writeErrors) return [];
    throw error;
  }
};

/** Igual que notifyUsers, pero jamás lanza: una notificación fallida no debe romper la acción principal. */
export const safeNotify = async (payload) => {
  try {
    return await notifyUsers(payload);
  } catch (error) {
    console.error(
      `[notifications] no se pudo notificar (${payload?.type}):`,
      error.message,
    );
    return [];
  }
};

const FILTERS = {
  all: {},
  unread: { read: false },
  system: { category: "system" },
  forum: { category: "forum" },
  task: { category: "task" },
};

export const getNotifications = async (
  userId,
  { filter = "all", page = 1, limit = 20 } = {},
) => {
  const query = { recipient: userId, ...(FILTERS[filter] ?? FILTERS.all) };
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .populate("actor", "name accountType")
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: userId, read: false }),
  ]);

  return {
    notifications,
    total,
    unreadCount,
    page: safePage,
    limit: safeLimit,
  };
};

export const getUnreadCount = async (userId) => {
  return await Notification.countDocuments({ recipient: userId, read: false });
};

export const markAsRead = async (notificationId, userId) => {
  // filtra por recipient: nadie puede marcar notificaciones ajenas
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { read: true, readAt: new Date() },
    { returnDocument: "after" },
  );
  if (!notification) throw new ApiError(404, "Notification not found");
  return notification;
};

export const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, read: false },
    { read: true, readAt: new Date() },
  );
  return { updated: result.modifiedCount };
};
