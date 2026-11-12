
import Notification from "../models/notification.model.js";
import "../models/sectorJoinRequest.model.js";
import ApiError from "../utils/apiError.js";

// Crea una notificación por destinatario y evita notificar al actor.
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
  joinRequest = null,
  actionStatus = null,
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
    ...(joinRequest ? { joinRequest } : {}),
    ...(actionStatus ? { actionStatus } : {}),
    ...(dedupeKey ? { dedupeKey } : {}),
  }));

  try {
    return await Notification.insertMany(docs, { ordered: false });
  } catch (error) {
    if (error.code === 11000 || error.writeErrors) return [];
    throw error;
  }
};

// Una notificación fallida nunca debe romper la operación principal.
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

// Mantiene sincronizadas todas las copias de una misma solicitud,
// una por administrador destinatario.
export const updateJoinRequestNotifications = async ({
  requestId,
  title,
  description,
  actionStatus,
  session,
}) => {
  if (!requestId) return { modifiedCount: 0 };

  return Notification.updateMany(
    {
      joinRequest: requestId,
      type: "sector_join_request",
    },
    {
      $set: {
        title,
        description,
        actionStatus,
        // Mientras está pendiente no caduca. Una vez resuelta conserva
        // la política habitual de 60 días desde el momento de resolución.
        expiresAt:
          actionStatus === "pending"
            ? null
            : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    },
    session ? { session } : undefined,
  );
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
  const query = {
    recipient: userId,
    ...(FILTERS[filter] ?? FILTERS.all),
  };

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .populate("actor", "name accountType")
      .populate({
        path: "joinRequest",
        select: "status user sector createdAt",
        populate: [
          { path: "user", select: "name accountType profilePicture" },
          { path: "sector", select: "name color icon accessMode" },
        ],
      })
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),

    Notification.countDocuments(query),

    Notification.countDocuments({
      recipient: userId,
      read: false,
    }),
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
  return Notification.countDocuments({
    recipient: userId,
    read: false,
  });
};

export const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      recipient: userId,
    },
    {
      read: true,
      readAt: new Date(),
    },
    {
      returnDocument: "after",
    },
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  return notification;
};

export const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    {
      recipient: userId,
      read: false,
    },
    {
      read: true,
      readAt: new Date(),
    },
  );

  return {
    updated: result.modifiedCount,
  };
};
