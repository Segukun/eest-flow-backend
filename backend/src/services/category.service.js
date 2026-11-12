import mongoose from "mongoose";
import Category from "../models/category.model.js";
import Sector from "../models/sector.model.js";
import Task from "../models/task.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";
import { safeNotify } from "./notification.service.js";
import {
  buildSectorVisibilityFilter,
  canAccessBySector,
} from "./visibility.service.js";

export const MODERATOR_REQUIRED_CODE = "MODERATOR_REQUIRED";
export const MODERATOR_REQUIRED_MESSAGE =
  "No tienes permiso de mover esta tarjeta a Terminado. Prueba moverla a Revisión para que un moderador pueda verla";

const toIds = (list) =>
  Array.isArray(list) ? list.map((item) => String(item?._id ?? item)) : [];

const unique = (list) => [...new Set(toIds(list))];

/**
 * ¿Puede este usuario mover tareas a "Terminado" en esta categoría?
 * - Admin: siempre.
 * - Categoría sin moderación (modo "all") o sin categoría: todos.
 * - Modo "custom": solo los moderadores elegidos.
 */
export function canModerateCategory(user, category) {
  if (!user) return false;
  if (user.accountType === "admin") return true;
  if (!category || category.moderatorMode !== "custom") return true;

  return toIds(category.moderators).includes(String(user._id));
}

/* ------------------------------ helpers ------------------------------ */

// De una lista de usuarios, los que existen, están activos y pertenecen a algún sector dado.
const filterUsersInSectors = async (userIds, sectorIds) => {
  if (userIds.length === 0 || sectorIds.length === 0) return [];

  const users = await User.find({
    _id: { $in: userIds },
    active: true,
    accountType: "collaborator",
    sectors: { $in: sectorIds },
  }).select("_id");

  return users.map((user) => String(user._id));
};

const assertUsersInSectors = async (userIds, sectorIds) => {
  const valid = await filterUsersInSectors(userIds, sectorIds);

  if (valid.length !== userIds.length) {
    throw new ApiError(
      400,
      "Moderators must be active users from the category sectors",
    );
  }
};

/* ---------------------------- notificaciones ---------------------------- */

const notifyModeratorsSelected = (category, userIds, actor) => {
  if (userIds.length === 0) return Promise.resolve([]);

  const others = userIds.length - 1;

  const title =
    others === 0
      ? `Has sido seleccionado como moderador de la categoría «${category.name}»`
      : `Tú y ${others} ${
          others === 1 ? "persona más han" : "personas más han"
        } sido seleccionadas como moderadores de la categoría «${category.name}»`;

  return safeNotify({
    recipients: userIds,
    actorId: actor?._id,
    category: "system",
    type: "category_moderator_selected",
    title,
    description: "Podés mover tareas a la columna Terminado en esta categoría.",
    link: "/",
  });
};

const notifySectorsRemoved = async ({
  category,
  removedSectorIds,
  affectedUsers,
  lostAccessIds,
  actor,
}) => {
  const sectors = await Sector.find({ _id: { $in: removedSectorIds } }).select(
    "name",
  );
  const nameById = new Map(
    sectors.map((sector) => [String(sector._id), sector.name]),
  );

  // Mismo texto -> un solo envío.
  const groups = new Map();

  for (const user of affectedUsers) {
    const names = toIds(user.sectors)
      .filter((id) => removedSectorIds.includes(id))
      .map((id) => nameById.get(id) ?? "Sector");

    const lostAccess = lostAccessIds.includes(String(user._id));
    const key = `${lostAccess}|${names.join("|")}`;

    if (!groups.has(key)) groups.set(key, { names, lostAccess, recipients: [] });
    groups.get(key).recipients.push(String(user._id));
  }

  await Promise.all(
    [...groups.values()].map(({ names, lostAccess, recipients }) =>
      safeNotify({
        recipients,
        actorId: actor?._id,
        category: "system",
        type: "category_sector_removed",
        title:
          names.length === 1
            ? `Tu sector «${names[0]}» fue quitado de la categoría «${category.name}»`
            : `Tus sectores «${names.join("», «")}» fueron quitados de la categoría «${category.name}»`,
        description: lostAccess
          ? "Ya no tenés acceso a esta categoría ni a sus tareas."
          : "Seguís teniendo acceso a la categoría por otro de tus sectores.",
        link: "/",
      }),
    ),
  );
};

/* ------------------------------- CRUD ------------------------------- */

export const createCategory = async (categoryData, actor) => {
  const exists = await Category.findOne({ name: categoryData.name.trim() });
  if (exists) {
    throw new ApiError(400, "Category already exists");
  }

  const sectorIds = unique(categoryData.sectors);
  const moderatorMode = categoryData.moderatorMode ?? "all";

  let moderators = [];

  if (moderatorMode === "custom") {
    moderators = unique(categoryData.moderators ?? []);

    if (moderators.length === 0) {
      throw new ApiError(400, "Select at least one moderator");
    }

    await assertUsersInSectors(moderators, sectorIds);
  }

  const category = await Category.create({
    name: categoryData.name,
    color: categoryData.color,
    sectors: sectorIds,
    moderatorMode,
    moderators,
  });

  await notifyModeratorsSelected(category, moderators, actor);

  return category;
};

// Admin: todas. Colaborador: solo las de sus sectores.
export const getCategories = async (user) => {
  return await Category.find({
    active: true,
    ...buildSectorVisibilityFilter(user),
  });
};

// Ids de las categorías que el usuario puede ver (lo usa task.service).
export const getVisibleCategoryIds = async (user) => {
  const categories = await Category.find({
    active: true,
    ...buildSectorVisibilityFilter(user),
  }).select("_id");

  return categories.map((category) => category._id);
};

export const getCategoryById = async (categoryId, user) => {
  const category = await Category.findById(categoryId);

  // 404 (no 403) para no revelar que la categoría existe.
  if (!category || !canAccessBySector(user, category.sectors)) {
    throw new ApiError(404, "Category not found");
  }

  return category;
};

export const updateCategory = async (categoryId, categoryData, actor) => {
  const previous = await Category.findOne({ _id: categoryId, active: true });
  if (!previous) throw new ApiError(404, "Category not found");

  /* ---- sectores ---- */

  const previousSectorIds = unique(previous.sectors);
  const nextSectorIds =
    categoryData.sectors !== undefined
      ? unique(categoryData.sectors)
      : previousSectorIds;
  const removedSectorIds = previousSectorIds.filter(
    (id) => !nextSectorIds.includes(id),
  );

  const update = {};
  if (categoryData.name !== undefined) update.name = categoryData.name;
  if (categoryData.color !== undefined) update.color = categoryData.color;
  if (categoryData.sectors !== undefined) update.sectors = nextSectorIds;

  /* ---- moderadores ---- */

  const mode = categoryData.moderatorMode ?? previous.moderatorMode ?? "all";
  let moderators = [];

  if (mode === "custom") {
    const explicit = categoryData.moderators !== undefined;

    if (explicit || previous.moderatorMode !== "custom") {
      moderators = unique(categoryData.moderators ?? []);

      if (moderators.length === 0) {
        throw new ApiError(400, "Select at least one moderator");
      }

      await assertUsersInSectors(moderators, nextSectorIds);
    } else {
      // Lista existente: se descartan en silencio los que ya no califican.
      moderators = await filterUsersInSectors(
        unique(previous.moderators),
        nextSectorIds,
      );
    }
  }

  update.moderatorMode = mode;
  update.moderators = moderators;

  const previousModerators =
    previous.moderatorMode === "custom" ? unique(previous.moderators) : [];
  const newlySelected = moderators.filter(
    (id) => !previousModerators.includes(id),
  );

  /* ---- usuarios afectados por sectores quitados ---- */

  let affectedUsers = [];
  let lostAccessIds = [];

  if (removedSectorIds.length > 0) {
    affectedUsers = await User.find({
      accountType: { $ne: "admin" },
      sectors: { $in: removedSectorIds },
    }).select("_id sectors");

    lostAccessIds = affectedUsers
      .filter(
        (user) => !toIds(user.sectors).some((id) => nextSectorIds.includes(id)),
      )
      .map((user) => String(user._id));
  }

  /* ---- escritura atómica: categoría + desasignación de tareas ---- */

  const session = await mongoose.startSession();
  let category;

  try {
    await session.withTransaction(async () => {
      category = await Category.findOneAndUpdate(
        { _id: categoryId, active: true },
        update,
        { returnDocument: "after", runValidators: true, session },
      );

      if (!category) throw new ApiError(404, "Category not found");

      if (lostAccessIds.length > 0) {
        await Task.updateMany(
          { category: categoryId, assignedUser: { $in: lostAccessIds } },
          { $pull: { assignedUser: { $in: lostAccessIds } } },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  /* ---- avisos (después de confirmar; nunca rompen la operación) ---- */

  await notifyModeratorsSelected(category, newlySelected, actor);

  if (removedSectorIds.length > 0) {
    await notifySectorsRemoved({
      category,
      removedSectorIds,
      affectedUsers,
      lostAccessIds,
      actor,
    });
  }

  return category;
};

//TODO: Cuando pasa esto eliminar el contenido del campo category de las tarjetas asociadas.
export const disableCategory = async (categoryId) => {
  const category = await Category.findByIdAndUpdate(
    categoryId,
    { active: false },
    { returnDocument: "after" },
  );
  if (!category) throw new ApiError(404, "Category not found");
  return category;
};