import mongoose from "mongoose";

import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";

import * as sectorService from "./sector.service.js";
import { safeNotify } from "./notification.service.js";

import {
  uploadProfilePictureFile,
  getProfilePictureSignedUrl,
  deleteProfilePictureFile,
} from "./profile-picture-storage.service.js";

/**
 * Convierte documentos Mongoose a objetos de respuesta y
 * agrega la URL firmada de la imagen de perfil.
 */
const withProfilePictureUrl = async (userDocument) => {
  if (!userDocument) return userDocument;

  const user =
    typeof userDocument.toObject === "function"
      ? userDocument.toObject()
      : { ...userDocument };

  const profilePicturePath = user.profilePicture;

  user.profilePicture = profilePicturePath
    ? {
        path: profilePicturePath,
        url: await getProfilePictureSignedUrl(profilePicturePath),
      }
    : null;

  return user;
};

/**
 * Comprueba que el solicitante pueda modificar la imagen
 * de perfil del usuario indicado.
 *
 * Se permite al propio usuario o a un administrador.
 */
const assertCanManageProfilePicture = (userId, requester) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const isSelf = String(requester?._id) === String(userId);
  const isAdmin = requester?.accountType === "admin";

  if (!isSelf && !isAdmin) {
    throw new ApiError(403, "Forbidden");
  }
};

const populateUser = (user) => user.populate("sectors", "name color");

export const getUserById = async (userId) => {
  const user = await User.findById(userId).populate(
    "sectors",
    "name color",
  );

  if (!user?.active) {
    throw new ApiError(404, "User not found");
  }

  return withProfilePictureUrl(user);
};

export const getUsers = async ({ sector } = {}) => {
  const filter = { active: true };

  if (sector) {
    filter.sectors = sector;
  }

  const users = await User.find(filter).populate(
    "sectors",
    "name color",
  );

  return Promise.all(users.map(withProfilePictureUrl));
};

export const updateUser = async (userId, requester, payload) => {
  const isSelf = requester._id.toString() === userId;
  const isAdmin = requester.accountType === "admin";

  if (!isSelf && !isAdmin) {
    throw new ApiError(403, "Forbidden");
  }

  const allowedFields = isAdmin
    ? ["name", "email", "sectors", "accountType"]
    : ["name", "email"];

  const updates = {};

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      updates[field] = payload[field];
    }
  }

  let previousSectorIds = null;

  if (updates.sectors) {
    await sectorService.validateSectorsExist(updates.sectors);

    const before = await User.findById(userId).select("sectors");

    previousSectorIds = (before?.sectors ?? []).map(String);
  }

  if (updates.email) {
    const emailTaken = await User.findOne({
      email: updates.email,
      _id: { $ne: userId },
    });

    if (emailTaken) {
      throw new ApiError(409, "Email already exists");
    }
  }

  const user = await User.findByIdAndUpdate(userId, updates, {
    returnDocument: "after",
    runValidators: true,
  }).populate("sectors", "name color");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (previousSectorIds) {
    const nextIds = user.sectors.map((s) => String(s._id));

    const changed =
      nextIds.length !== previousSectorIds.length ||
      nextIds.some((id) => !previousSectorIds.includes(id));

    if (changed) {
      await safeNotify({
        recipients: [userId],
        actorId: requester._id,
        category: "system",
        type: "sector_changed",
        title: "Se actualizaron tus sectores",
        description: `Ahora pertenecés a: ${user.sectors.map((s) => s.name).join(", ")}`,
        link: "/",
      });
    }
  }

  return withProfilePictureUrl(user);
};

/**
 * Sube o reemplaza la imagen de perfil.
 */
export const updateProfilePicture = async (
  userId,
  requester,
  file,
) => {
  assertCanManageProfilePicture(userId, requester);

  if (!file) {
    throw new ApiError(400, "Select an image to upload");
  }

  const user = await User.findOne({
    _id: userId,
    active: true,
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const previousPath = user.profilePicture;

  // Primero subimos la nueva imagen a Supabase.
  const newPath = await uploadProfilePictureFile(userId, file);

  // Actualizamos la referencia en MongoDB.
  user.profilePicture = newPath;

  try {
    await user.save();
  } catch (error) {
    // Si falla MongoDB, eliminamos la nueva imagen
    // para evitar archivos huérfanos en Supabase.
    await deleteProfilePictureFile(newPath).catch((cleanupError) => {
      console.error(
        "No se pudo limpiar la nueva imagen tras fallar MongoDB:",
        cleanupError,
      );
    });

    throw error;
  }

  // Una vez actualizada MongoDB, eliminamos la imagen anterior.
  if (previousPath) {
    await deleteProfilePictureFile(previousPath).catch((error) => {
      console.error(
        "No se pudo eliminar la imagen de perfil anterior:",
        error,
      );
    });
  }

  const populatedUser = await populateUser(user);

  return withProfilePictureUrl(populatedUser);
};

/**
 * Elimina la imagen de perfil del usuario.
 */
export const deleteProfilePicture = async (userId, requester) => {
  assertCanManageProfilePicture(userId, requester);

  const user = await User.findOne({
    _id: userId,
    active: true,
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const previousPath = user.profilePicture;

  // Primero quitamos la referencia de MongoDB.
  user.profilePicture = null;

  await user.save();

  // Después eliminamos el archivo físico.
  if (previousPath) {
    await deleteProfilePictureFile(previousPath).catch((error) => {
      console.error(
        "No se pudo eliminar la imagen de perfil de Supabase:",
        error,
      );
    });
  }

  const populatedUser = await populateUser(user);

  return withProfilePictureUrl(populatedUser);
};

export const disableUser = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { active: false },
    { returnDocument: "after" },
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};