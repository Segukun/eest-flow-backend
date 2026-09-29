import * as labelService from "../services/label.service.js";

export const createLabel = async (req, res, next) => {
  try {
    const label = await labelService.createLabel(req.body);
    return res.status(201).json(label);
  } catch (error) {
    return next(error);
  }
};

export const getLabels = async (req, res, next) => {
  try {
    const labels = await labelService.getLabels(req.query.category);
    return res.status(200).json(labels);
  } catch (error) {
    return next(error);
  }
};

export const getLabelById = async (req, res, next) => {
  try {
    const label = await labelService.getLabelById(req.params.id);
    return res.status(200).json(label);
  } catch (error) {
    return next(error);
  }
};

export const updateLabel = async (req, res, next) => {
  try {
    const label = await labelService.updateLabel(req.params.id, req.body);
    return res.status(200).json(label);
  } catch (error) {
    return next(error);
  }
};

export const disableLabel = async (req, res, next) => {
  try {
    const label = await labelService.disableLabel(req.params.id);
    return res.status(200).json(label);
  } catch (error) {
    return next(error);
  }
};