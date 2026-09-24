export function buildSectorVisibilityFilter(user) {
  if (user.accountType === "admin") {
    return {};
  }

  return { sectors: { $in: user.sectors } };
}

export function canAccessBySector(user, documentSectors = []) {
  if (user.accountType === "admin") return true;

  const userSectorIds = user.sectors.map((s) => s.toString());
  return documentSectors.some((sectorId) => userSectorIds.includes(sectorId.toString()));
}