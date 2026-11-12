
import mongoose from "mongoose";

import Sector from "../models/sector.model.js";
import User from "../models/user.model.js";
import Category from "../models/category.model.js";
import Task from "../models/task.model.js";
import SectorJoinRequest from "../models/sectorJoinRequest.model.js";
import ApiError from "../utils/apiError.js";

import {
  safeNotify,
  updateJoinRequestNotifications,
} from "./notification.service.js";

const toIds = (values = []) =>
  (Array.isArray(values) ? values : []).map((value) =>
    String(value?._id ?? value?.id ?? value),
  );

const uniqueIds = (values = []) => [...new Set(toIds(values))];

const getAdminIds = async () =>
  User.find({
    active: true,
    accountType: "admin",
  }).distinct("_id");

const notifySectorMovement = async ({
  user,
  sector,
  action,
  actor = null,
  description = "",
}) => {
  if (!user?._id || !sector?._id) return;

  const recipients = await getAdminIds();
  const joined = action === "joined";

  await safeNotify({
    recipients,
    actorId: actor?._id,
    category: "system",
    type: "movement",
    title: joined
      ? `${user.name} se unió al sector «${sector.name}»`
      : `${user.name} abandonó el sector «${sector.name}»`,
    description:
      description ||
      (joined
        ? "Se agregó un miembro al sector."
        : "Un miembro dejó el sector."),
    link: "/sectores",
  });
};

const notifyJoinRequestResult = async ({
  userId,
  sector,
  status,
  actor,
  automatic = false,
}) => {
  const approved = status === "approved";

  const title = automatic
    ? `Tu solicitud para unirte a «${sector.name}» fue aprobada automáticamente`
    : approved
      ? `Tu solicitud para unirte a «${sector.name}» fue aceptada`
      : `Tu solicitud para unirte a «${sector.name}» fue rechazada`;

  await safeNotify({
    recipients: [userId],
    actorId: automatic ? null : actor?._id,
    category: "system",
    type: "sector_join_result",
    title,
    description: automatic
      ? "El sector ahora es público y ya formás parte de él."
      : approved
        ? "Ya podés acceder a este sector y a sus contenidos."
        : "Podés volver a solicitar acceso más adelante.",
    link: "/sectores",
  });
};

const notifyAdminsOfJoinRequest = async ({
  request,
  user,
  sector,
}) => {
  const recipients = await getAdminIds();

  await safeNotify({
    recipients,
    actorId: user?._id,
    category: "system",
    type: "sector_join_request",
    title: `${user.name} solicita unirse al sector «${sector.name}»`,
    description: "Revisá la solicitud y elegí aceptar o rechazar.",
    link: "/notificaciones",
    joinRequest: request._id,
    actionStatus: "pending",
  });

  // Si la solicitud se resolvió antes de que se insertaran las notificaciones,
  // actualizamos igualmente las copias recién creadas.
  const latest = await SectorJoinRequest.findById(request._id)
    .populate("user", "name")
    .populate("sector", "name")
    .populate("resolvedBy", "name");

  if (!latest || latest.status === "pending") return;

  let title;
  let description;

  if (latest.status === "cancelled") {
    title = `${latest.user?.name ?? user.name} canceló su solicitud para unirse a «${latest.sector?.name ?? sector.name}»`;
    description = "La solicitud fue cancelada por quien la había enviado.";
  } else if (latest.resolutionSource === "sector_public") {
    title = `El sector «${latest.sector?.name ?? sector.name}» ahora es público: se aprobó la solicitud de ${latest.user?.name ?? user.name}`;
    description = "La solicitud se aprobó automáticamente al habilitar el acceso público.";
  } else {
    const accepted = latest.status === "approved";

    title = `${latest.resolvedBy?.name || "Un administrador"} ${
      accepted ? "aceptó" : "rechazó"
    } agregar a ${latest.user?.name ?? user.name} al sector «${latest.sector?.name ?? sector.name}»`;

    description = "La solicitud ya fue resuelta y no admite más acciones.";
  }

  await updateJoinRequestNotifications({
    requestId: latest._id,
    title,
    description,
    actionStatus: latest.status,
  });
};

const getLostCategoryIds = async ({
  previousSectorIds,
  nextSectorIds,
  user,
  session,
}) => {
  // Los administradores conservan acceso global.
  if (user?.accountType === "admin") return [];

  const categories = await Category.find({
    active: true,
    sectors: { $in: previousSectorIds },
  })
    .select("_id sectors")
    .session(session);

  const nextSet = new Set(nextSectorIds);

  return categories
    .filter(
      (category) =>
        !toIds(category.sectors).some((sectorId) =>
          nextSet.has(sectorId),
        ),
    )
    .map((category) => category._id);
};

const cleanCategoryAssignments = async ({
  userId,
  lostCategoryIds,
  session,
}) => {
  if (!lostCategoryIds.length) return;

  await Task.updateMany(
    {
      category: { $in: lostCategoryIds },
      assignedUser: userId,
    },
    {
      $pull: { assignedUser: userId },
    },
    { session },
  );

  await Category.updateMany(
    { _id: { $in: lostCategoryIds } },
    {
      $pull: { moderators: userId },
    },
    { session },
  );
};

const notifyMembershipChanges = async ({
  user,
  addedSectorIds,
  removedSectorIds,
  actor,
}) => {
  const allIds = [
    ...new Set([...addedSectorIds, ...removedSectorIds]),
  ];

  if (!allIds.length) return;

  const sectors = await Sector.find({
    _id: { $in: allIds },
  }).select("name");

  const byId = new Map(
    sectors.map((sector) => [String(sector._id), sector]),
  );

  await Promise.all([
    ...addedSectorIds.map((id) =>
      notifySectorMovement({
        user,
        sector: byId.get(id),
        action: "joined",
        actor,
        description: "Se agregó un miembro al sector.",
      }),
    ),
    ...removedSectorIds.map((id) =>
      notifySectorMovement({
        user,
        sector: byId.get(id),
        action: "left",
        actor,
        description: "Un miembro dejó el sector.",
      }),
    ),
  ]);
};

/**
 * Cambia los sectores de un usuario desde una acción administrativa.
 * También limpia tareas y moderadores de las categorías que deja de ver.
 */
export const updateUserSectors = async (
  userId,
  sectorIds,
  actor,
) => {
  const nextSectorIds = uniqueIds(sectorIds);

  if (nextSectorIds.length === 0) {
    throw new ApiError(
      400,
      "A user must belong to at least one sector",
    );
  }

  await validateSectorsExist(nextSectorIds);

  const previousUser = await User.findOne({
    _id: userId,
    active: true,
  }).select("_id name accountType sectors");

  if (!previousUser) {
    throw new ApiError(404, "User not found");
  }

  const previousSectorIds = uniqueIds(previousUser.sectors);

  const addedSectorIds = nextSectorIds.filter(
    (id) => !previousSectorIds.includes(id),
  );

  const removedSectorIds = previousSectorIds.filter(
    (id) => !nextSectorIds.includes(id),
  );

  if (!addedSectorIds.length && !removedSectorIds.length) {
    return User.findById(userId).populate(
      "sectors",
      "name color accessMode",
    );
  }

  const addedSectors = addedSectorIds.length
    ? await Sector.find({
        _id: { $in: addedSectorIds },
      }).select("name")
    : [];

  const sectorById = new Map(
    addedSectors.map((sector) => [
      String(sector._id),
      sector,
    ]),
  );

  const session = await mongoose.startSession();

  let updatedUser;
  let approvedRequests = [];

  try {
    await session.withTransaction(async () => {
      approvedRequests = [];

      const lostCategoryIds = await getLostCategoryIds({
        previousSectorIds,
        nextSectorIds,
        user: previousUser,
        session,
      });

      updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
          active: true,
        },
        {
          $set: { sectors: nextSectorIds },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!updatedUser) {
        throw new ApiError(404, "User not found");
      }

      await cleanCategoryAssignments({
        userId,
        lostCategoryIds,
        session,
      });

      // Si un administrador agrega manualmente a alguien que tenía
      // una solicitud pendiente, la solicitud también queda aprobada.
      if (addedSectorIds.length > 0) {
        const pendingRequests = await SectorJoinRequest.find({
          user: userId,
          sector: { $in: addedSectorIds },
          status: "pending",
        }).session(session);

        for (const request of pendingRequests) {
          const sector = sectorById.get(String(request.sector));

          request.status = "approved";
          request.resolvedBy = actor?._id ?? null;
          request.resolvedAt = new Date();
          request.resolutionSource = "admin";

          await request.save({ session });

          await updateJoinRequestNotifications({
            requestId: request._id,
            title: `${actor?.name || "Un administrador"} agregó a ${previousUser.name} al sector «${sector?.name || "Sector"}»`,
            description: "La solicitud quedó aprobada al asignarte el sector.",
            actionStatus: "approved",
            session,
          });

          approvedRequests.push({ sector });
        }
      }
    });
  } finally {
    await session.endSession();
  }

  await notifyMembershipChanges({
    user: updatedUser,
    addedSectorIds,
    removedSectorIds,
    actor,
  });

  for (const { sector } of approvedRequests) {
    if (!sector) continue;

    await notifyJoinRequestResult({
      userId,
      sector,
      status: "approved",
      actor,
    });
  }

  // Cerramos posibles solicitudes que se hayan creado en paralelo.
  if (addedSectorIds.length > 0) {
    const pendingAfterCommit = await SectorJoinRequest.find({
      user: userId,
      sector: { $in: addedSectorIds },
      status: "pending",
    }).select("_id");

    for (const pendingRequest of pendingAfterCommit) {
      try {
        await resolveJoinRequest(
          pendingRequest._id,
          "approved",
          actor,
          { notifyMovement: false },
        );
      } catch (error) {
        if (error?.statusCode !== 409) throw error;
      }
    }
  }

  return updatedUser.populate(
    "sectors",
    "name color accessMode",
  );
};

/**
 * Crea un sector. El acceso es público por defecto.
 */
export const createSector = async ({
  name,
  description = "",
  color,
  icon = "FiUsers",
  accessMode = "public",
}) => {
  const exists = await Sector.findOne({
    name: name.trim(),
  });

  if (exists) {
    throw new ApiError(
      409,
      "A sector with that name already exists",
    );
  }

  return Sector.create({
    name,
    description,
    color,
    icon,
    accessMode,
  });
};

export const getSectors = async () => {
  const sectors = await Sector.find({
    active: true,
  })
    .sort({ name: 1 })
    .lean();

  return Promise.all(
    sectors.map(async (sector) => ({
      ...sector,
      accessMode: sector.accessMode ?? "public",
      categoryCount: await Category.countDocuments({
        active: true,
        sectors: sector._id,
      }),
    })),
  );
};

export const getSectorById = async (sectorId) => {
  if (!mongoose.isValidObjectId(sectorId)) {
    throw new ApiError(400, "Invalid sector id");
  }

  const sector = await Sector.findOne({
    _id: sectorId,
    active: true,
  });

  if (!sector) {
    throw new ApiError(404, "Sector not found");
  }

  return sector;
};

/**
 * Al volver público un sector, aprueba automáticamente sus solicitudes.
 */
const approvePendingRequestsBecausePublic = async ({
  sector,
  actor,
  session,
}) => {
  const pending = await SectorJoinRequest.find({
    sector: sector._id,
    status: "pending",
  }).session(session);

  const approved = [];

  for (const request of pending) {
    const user = await User.findOneAndUpdate(
      {
        _id: request.user,
        active: true,
      },
      {
        $addToSet: { sectors: sector._id },
      },
      {
        returnDocument: "after",
        session,
      },
    );

    const nextStatus = user ? "approved" : "rejected";
    const resolvedAt = new Date();

    request.status = nextStatus;
    request.resolvedAt = resolvedAt;
    request.resolvedBy = actor?._id ?? null;
    request.resolutionSource = "sector_public";

    await request.save({ session });

    await updateJoinRequestNotifications({
      requestId: request._id,
      title: user
        ? `El sector «${sector.name}» ahora es público: se aprobó la solicitud de ${user.name}`
        : `No se pudo aprobar la solicitud de un usuario al sector «${sector.name}»`,
      description: user
        ? "La solicitud se aprobó automáticamente al habilitar el acceso público."
        : "La cuenta solicitante ya no está activa.",
      actionStatus: nextStatus,
      session,
    });

    if (user) {
      approved.push({ request, user });
    }
  }

  return approved;
};

export const updateSector = async (
  sectorId,
  { name, description, color, icon, accessMode },
  actor,
) => {
  if (!mongoose.isValidObjectId(sectorId)) {
    throw new ApiError(400, "Invalid sector id");
  }

  const previous = await Sector.findOne({
    _id: sectorId,
    active: true,
  });

  if (!previous) {
    throw new ApiError(404, "Sector not found");
  }

  const update = {};

  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (color !== undefined) update.color = color;
  if (icon !== undefined) update.icon = icon;
  if (accessMode !== undefined) update.accessMode = accessMode;

  const session = await mongoose.startSession();

  let sector;
  let automaticallyApproved = [];

  try {
    await session.withTransaction(async () => {
      automaticallyApproved = [];

      sector = await Sector.findOneAndUpdate(
        {
          _id: sectorId,
          active: true,
        },
        update,
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!sector) {
        throw new ApiError(404, "Sector not found");
      }

      const becomingPublic =
        accessMode === "public" &&
        (previous.accessMode ?? "public") !== "public";

      if (becomingPublic) {
        automaticallyApproved =
          await approvePendingRequestsBecausePublic({
            sector,
            actor,
            session,
          });
      }
    });
  } finally {
    await session.endSession();
  }

  for (const { user } of automaticallyApproved) {
    await notifyJoinRequestResult({
      userId: user._id,
      sector,
      status: "approved",
      automatic: true,
    });

    await notifySectorMovement({
      user,
      sector,
      action: "joined",
      actor,
      description:
        "Ingreso aprobado automáticamente al habilitar el acceso público.",
    });
  }

  return sector;
};

export const disableSector = async (sectorId) => {
  const membersCount = await User.countDocuments({
    sectors: sectorId,
    active: true,
  });

  if (membersCount > 0) {
    throw new ApiError(
      409,
      "Cannot disable a sector that still has active members. Reassign them first.",
    );
  }

  const sector = await Sector.findByIdAndUpdate(
    sectorId,
    { active: false },
    { returnDocument: "after" },
  );

  if (!sector) {
    throw new ApiError(404, "Sector not found");
  }

  const pending = await SectorJoinRequest.find({
    sector: sectorId,
    status: "pending",
  }).populate("user", "name");

  for (const request of pending) {
    request.status = "cancelled";
    request.resolvedAt = new Date();

    await request.save();

    await updateJoinRequestNotifications({
      requestId: request._id,
      title: `La solicitud de acceso al sector «${sector.name}» fue cancelada`,
      description: "El sector dejó de estar disponible.",
      actionStatus: "cancelled",
    });
  }

  return sector;
};

export const getSectorMembers = async (sectorId, requester) => {
  const sector = await getSectorById(sectorId);

  const memberFields =
    requester?.accountType === "admin"
      ? "name email accountType profilePicture sectors"
      : "name accountType profilePicture sectors";

  const members = await User.find({
    sectors: sectorId,
    active: true,
  })
    .select(memberFields)
    .populate("sectors", "name color")
    .sort({ name: 1 });

  return { sector, members };
};

export const validateSectorsExist = async (sectorIds = []) => {
  if (!Array.isArray(sectorIds) || sectorIds.length === 0) {
    throw new ApiError(
      400,
      "sectors must be a non-empty array",
    );
  }

  const ids = uniqueIds(sectorIds);

  const count = await Sector.countDocuments({
    _id: { $in: ids },
    active: true,
  });

  if (count !== ids.length) {
    throw new ApiError(400, "One or more sectors are invalid");
  }
};

/**
 * Se une directamente si el sector es público.
 * Los administradores también pueden entrar directamente a sectores restringidos.
 * Los colaboradores, en sectores restringidos, generan una solicitud.
 */
export const joinSector = async (sectorId, actor) => {
  const sector = await getSectorById(sectorId);

  if (!actor?._id) {
    throw new ApiError(401, "Authentication required");
  }

  const user = await User.findOne({
    _id: actor._id,
    active: true,
  }).select("_id name accountType sectors");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (toIds(user.sectors).includes(String(sector._id))) {
    return { status: "member", sector };
  }

  const accessMode = sector.accessMode ?? "public";

  const canJoinDirectly =
    user.accountType === "admin" ||
    accessMode === "public";

  if (canJoinDirectly) {
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        active: true,
        sectors: { $ne: sector._id },
      },
      {
        $addToSet: { sectors: sector._id },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!updatedUser) {
      const latestUser = await User.findById(user._id).select("sectors");

      if (
        latestUser &&
        toIds(latestUser.sectors).includes(String(sector._id))
      ) {
        return { status: "member", sector };
      }

      throw new ApiError(404, "User not found");
    }

    await notifySectorMovement({
      user: updatedUser,
      sector,
      action: "joined",
      actor,
      description:
        user.accountType === "admin"
          ? "Un administrador se unió directamente al sector."
          : "Ingreso directo a un sector público.",
    });

    return { status: "joined", sector };
  }

  // Serializa las solicitudes con cambios del acceso del sector.
  let request;
  let joinedUser = null;
  let sectorAtCommit = sector;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      request = null;
      joinedUser = null;

      const requestableSector = await Sector.findOneAndUpdate(
        {
          _id: sector._id,
          active: true,
          accessMode: "request",
        },
        {
          $inc: { joinRequestVersion: 1 },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (requestableSector) {
        sectorAtCommit = requestableSector;

        const created = await SectorJoinRequest.create(
          [
            {
              user: user._id,
              sector: requestableSector._id,
              status: "pending",
            },
          ],
          { session },
        );

        request = created[0];
        return;
      }

      const latestSector = await Sector.findOne({
        _id: sector._id,
        active: true,
      }).session(session);

      if (!latestSector) {
        throw new ApiError(404, "Sector not found");
      }

      sectorAtCommit = latestSector;

      if ((latestSector.accessMode ?? "public") !== "public") {
        throw new ApiError(
          409,
          "Sector access settings changed. Try again.",
        );
      }

      joinedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          active: true,
          sectors: { $ne: sector._id },
        },
        {
          $addToSet: { sectors: sector._id },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!joinedUser) {
        const latestUser = await User.findById(user._id).session(session);

        if (
          latestUser &&
          toIds(latestUser.sectors).includes(String(sector._id))
        ) {
          joinedUser = latestUser;
          return;
        }

        throw new ApiError(404, "User not found");
      }
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await SectorJoinRequest.findOne({
        user: user._id,
        sector: sector._id,
        status: "pending",
      }).populate("sector", "name accessMode color icon");

      if (existing) {
        return { status: "requested", request: existing };
      }

      const [latestUser, latestSector] = await Promise.all([
        User.findById(user._id).select("sectors"),
        Sector.findOne({
          _id: sector._id,
          active: true,
        }),
      ]);

      if (
        latestUser &&
        toIds(latestUser.sectors).includes(String(sector._id))
      ) {
        return {
          status: "member",
          sector: latestSector ?? sector,
        };
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }

  if (joinedUser) {
    await notifySectorMovement({
      user: joinedUser,
      sector: sectorAtCommit,
      action: "joined",
      actor,
      description: "Ingreso directo a un sector que pasó a ser público.",
    });

    return {
      status: "joined",
      sector: sectorAtCommit,
    };
  }

  if (!request) {
    throw new ApiError(
      409,
      "The request could not be created. Try again.",
    );
  }

  await notifyAdminsOfJoinRequest({
    request,
    user,
    sector: sectorAtCommit,
  });

  // Si fue agregado manualmente en paralelo, cerramos la solicitud.
  const latestUser = await User.findById(user._id).select("sectors");

  if (
    latestUser &&
    toIds(latestUser.sectors).includes(String(sector._id))
  ) {
    try {
      await resolveJoinRequest(
        request._id,
        "approved",
        null,
        { notifyMovement: false },
      );
    } catch (error) {
      if (error?.statusCode !== 409) throw error;
    }

    return {
      status: "joined",
      sector: sectorAtCommit,
    };
  }

  return {
    status: "requested",
    request,
  };
};

export const getMyPendingJoinRequests = async (userId) => {
  return SectorJoinRequest.find({
    user: userId,
    status: "pending",
  })
    .populate("sector", "name description color icon accessMode")
    .sort({ createdAt: -1 });
};

export const cancelJoinRequest = async (requestId, actor) => {
  if (!mongoose.isValidObjectId(requestId)) {
    throw new ApiError(400, "Invalid request id");
  }

  const request = await SectorJoinRequest.findOneAndUpdate(
    {
      _id: requestId,
      user: actor?._id,
      status: "pending",
    },
    {
      $set: {
        status: "cancelled",
        resolvedAt: new Date(),
        resolvedBy: actor?._id,
      },
    },
    {
      returnDocument: "after",
    },
  )
    .populate("user", "name")
    .populate("sector", "name");

  if (!request) {
    throw new ApiError(
      409,
      "The request is no longer pending",
    );
  }

  await updateJoinRequestNotifications({
    requestId: request._id,
    title: `${request.user?.name ?? "El usuario"} canceló su solicitud para unirse a «${request.sector?.name ?? "el sector"}»`,
    description: "La solicitud fue cancelada por quien la había enviado.",
    actionStatus: "cancelled",
  });

  return request;
};

/**
 * Resuelve una solicitud con una operación atómica.
 * Si otro administrador ya la resolvió, el segundo recibe 409.
 */
export const resolveJoinRequest = async (
  requestId,
  decision,
  actor,
  { notifyMovement = true } = {},
) => {
  if (!mongoose.isValidObjectId(requestId)) {
    throw new ApiError(400, "Invalid request id");
  }

  if (!["approved", "rejected"].includes(decision)) {
    throw new ApiError(
      400,
      "Decision must be approved or rejected",
    );
  }

  const session = await mongoose.startSession();

  let request;
  let user;
  let sector;
  let finalStatus = decision;
  let automatic = false;

  try {
    await session.withTransaction(async () => {
      finalStatus = decision;
      automatic = false;

      const current = await SectorJoinRequest.findOne({
        _id: requestId,
        status: "pending",
      }).session(session);

      if (!current) {
        throw new ApiError(
          409,
          "This request has already been resolved",
        );
      }

      sector = await Sector.findOne({
        _id: current.sector,
        active: true,
      }).session(session);

      if (!sector) {
        throw new ApiError(404, "Sector not found");
      }

      user = await User.findOne({
        _id: current.user,
        active: true,
      }).session(session);

      if (!user) {
        throw new ApiError(
          404,
          "The requesting user is no longer active",
        );
      }

      // Si el sector pasó a público antes de la respuesta,
      // se aprueba automáticamente.
      if ((sector.accessMode ?? "public") === "public") {
        finalStatus = "approved";
        automatic = true;
      }

      const resolved = await SectorJoinRequest.findOneAndUpdate(
        {
          _id: requestId,
          status: "pending",
        },
        {
          $set: {
            status: finalStatus,
            resolvedBy: actor?._id ?? null,
            resolvedAt: new Date(),
            resolutionSource: automatic
              ? "sector_public"
              : "admin",
          },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!resolved) {
        throw new ApiError(
          409,
          "This request has already been resolved",
        );
      }

      request = resolved;

      if (finalStatus === "approved") {
        await User.updateOne(
          {
            _id: user._id,
            active: true,
          },
          {
            $addToSet: { sectors: sector._id },
          },
          { session },
        );
      }

      const actorName = automatic
        ? "El sistema"
        : actor?.name || "Un administrador";

      const actionText =
        finalStatus === "approved" ? "aceptó" : "rechazó";

      await updateJoinRequestNotifications({
        requestId,
        title: automatic
          ? `El sector «${sector.name}» ahora es público: se aprobó la solicitud de ${user.name}`
          : `${actorName} ${actionText} agregar a ${user.name} al sector «${sector.name}»`,
        description: automatic
          ? "La solicitud se aprobó automáticamente al habilitar el acceso público."
          : "La solicitud ya fue resuelta y no admite más acciones.",
        actionStatus: finalStatus,
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  if (finalStatus === "approved") {
    await notifyJoinRequestResult({
      userId: user._id,
      sector,
      status: "approved",
      actor: automatic ? null : actor,
      automatic,
    });

    if (notifyMovement) {
      await notifySectorMovement({
        user,
        sector,
        action: "joined",
        actor: automatic ? null : actor,
        description: automatic
          ? "Ingreso aprobado automáticamente al habilitar el acceso público."
          : "Solicitud de acceso aprobada por un administrador.",
      });
    }
  } else {
    await notifyJoinRequestResult({
      userId: user._id,
      sector,
      status: "rejected",
      actor,
    });
  }

  return {
    request,
    status: finalStatus,
    automatic,
  };
};

/**
 * Un usuario puede abandonar cualquier sector salvo el último.
 * Al perder acceso a categorías, se lo desasigna de tareas y moderaciones.
 */
export const leaveSector = async (sectorId, actor) => {
  if (!mongoose.isValidObjectId(sectorId)) {
    throw new ApiError(400, "Invalid sector id");
  }

  const sector = await getSectorById(sectorId);
  const session = await mongoose.startSession();

  let updatedUser;

  try {
    await session.withTransaction(async () => {
      const previousUser = await User.findOne({
        _id: actor?._id,
        active: true,
        sectors: sector._id,
      })
        .select("_id name accountType sectors")
        .session(session);

      if (!previousUser) {
        throw new ApiError(
          409,
          "You are not a member of this sector",
        );
      }

      const previousSectorIds = uniqueIds(previousUser.sectors);

      if (previousSectorIds.length <= 1) {
        throw new ApiError(
          400,
          "You must belong to at least one sector",
        );
      }

      const nextSectorIds = previousSectorIds.filter(
        (id) => id !== String(sector._id),
      );

      const lostCategoryIds = await getLostCategoryIds({
        previousSectorIds,
        nextSectorIds,
        user: previousUser,
        session,
      });

      // Evita que dos abandonos simultáneos dejen al usuario sin sectores.
      updatedUser = await User.findOneAndUpdate(
        {
          _id: previousUser._id,
          sectors: sector._id,
          $expr: {
            $gt: [{ $size: "$sectors" }, 1],
          },
        },
        {
          $pull: { sectors: sector._id },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!updatedUser) {
        throw new ApiError(
          400,
          "You must belong to at least one sector",
        );
      }

      await cleanCategoryAssignments({
        userId: previousUser._id,
        lostCategoryIds,
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  await notifySectorMovement({
    user: updatedUser,
    sector,
    action: "left",
    actor,
    description: "El usuario abandonó voluntariamente el sector.",
  });

  return {
    message: "You left the sector",
    user: await updatedUser.populate(
      "sectors",
      "name color accessMode",
    ),
  };
};
