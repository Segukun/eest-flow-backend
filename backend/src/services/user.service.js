import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";
import * as sectorService from "./sector.service.js";

export const getUserById = async (userId) => {
  const user = await User.findById(userId).populate("sectors", "name color");
  if (!user?.active) throw new ApiError(404, "User not found");
  return user;
};

export const getUsers = async ({ sector } = {}) => {
  const filter = { active: true };
  if (sector) filter.sectors = sector; // matchea si el array `sectors` contiene el id

  return await User.find(filter).populate("sectors", "name color");
};

export const updateUser = async (userId, requester, payload) => {
  const isSelf = requester._id.toString() === userId;
  const isAdmin = requester.accountType === "admin";

  if (!isSelf && !isAdmin) {
    throw new ApiError(403, "Forbidden");
  }

  // un collaborator solo puede tocar sus propios datos básicos;
  // sectors y accountType quedan reservados a admin, incluso sobre sí mismo
  const allowedFields = isAdmin ? ["name", "email", "sectors", "accountType"] : ["name", "email"];

  const updates = {};
  for (const field of allowedFields) {
    if (payload[field] !== undefined) updates[field] = payload[field];
  }

  if (updates.sectors) {
    await sectorService.validateSectorsExist(updates.sectors);
  }

  const user = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
  }).populate("sectors", "name color");

  if (!user) throw new ApiError(404, "User not found");
  return user;
};

export const disableUser = async (userId) => {
  const user = await User.findByIdAndUpdate(userId, { active: false }, { new: true });
  if (!user) throw new ApiError(404, "User not found");
  return user;
};