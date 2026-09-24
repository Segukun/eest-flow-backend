import * as sectorService from "../services/sector.service.js";

export const createSector = async (req, res, next) => {
  try {
    const sector = await sectorService.createSector(req.body);
    return res.status(201).json(sector);
  } catch (error) {
    return next(error);
  }
};

export const getSectors = async (req, res, next) => {
  try {
    const sectors = await sectorService.getSectors();
    return res.status(200).json(sectors);
  } catch (error) {
    return next(error);
  }
};

export const getSectorById = async (req, res, next) => {
  try {
    const sector = await sectorService.getSectorById(req.params.id);
    return res.status(200).json(sector);
  } catch (error) {
    return next(error);
  }
};

export const updateSector = async (req, res, next) => {
  try {
    const sector = await sectorService.updateSector(req.params.id, req.body);
    return res.status(200).json(sector);
  } catch (error) {
    return next(error);
  }
};

export const disableSector = async (req, res, next) => {
  try {
    const sector = await sectorService.disableSector(req.params.id);
    return res.status(200).json(sector);
  } catch (error) {
    return next(error);
  }
};

export const getSectorMembers = async (req, res, next) => {
  try {
    const result = await sectorService.getSectorMembers(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};