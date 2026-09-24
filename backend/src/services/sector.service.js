import Sector from "../models/sector.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";

export const createSector = async ({ name, description, color, icon }) => {
  const exists = await Sector.findOne({ name: name.trim() });
  if (exists) {
    throw new ApiError(409, "A sector with that name already exists");
  }

  return await Sector.create({ name, description, color, icon });
};

export const getSectors = async () => {
  return await Sector.find({ active: true }).sort({ name: 1 });
};

export const getSectorById = async (sectorId) => {
  const sector = await Sector.findById(sectorId);
  if (!sector) throw new ApiError(404, "Sector not found");
  return sector;
};

export const updateSector = async (sectorId, { name, description, color, icon }) => {
  const sector = await Sector.findByIdAndUpdate(
    sectorId,
    { name, description, color, icon },
    { new: true, runValidators: true },
  );

  if (!sector) throw new ApiError(404, "Sector not found");
  return sector;
};

// soft-delete: bloquea si todavía hay usuarios activos en ese sector,
// para no dejar referencias huérfanas en User.sectors
export const disableSector = async (sectorId) => {
  const membersCount = await User.countDocuments({ sectors: sectorId, active: true });
  if (membersCount > 0) {
    throw new ApiError(
      409,
      "Cannot disable a sector that still has active members. Reassign them first.",
    );
  }

  const sector = await Sector.findByIdAndUpdate(sectorId, { active: false }, { new: true });
  if (!sector) throw new ApiError(404, "Sector not found");
  return sector;
};

export const getSectorMembers = async (sectorId) => {
  const sector = await Sector.findById(sectorId);
  if (!sector) throw new ApiError(404, "Sector not found");

  const members = await User.find({ sectors: sectorId, active: true }).select(
    "name email accountType",
  );

  return { sector, members };
};

// usado por user.service.js para validar que todos los sectors
// enviados al crear/actualizar un usuario existan y estén activos
export const validateSectorsExist = async (sectorIds = []) => {
  if (!Array.isArray(sectorIds) || sectorIds.length === 0) {
    throw new ApiError(400, "sectors must be a non-empty array");
  }

  const count = await Sector.countDocuments({
    _id: { $in: sectorIds },
    active: true,
  });

  if (count !== sectorIds.length) {
    throw new ApiError(400, "One or more sectors are invalid");
  }
};