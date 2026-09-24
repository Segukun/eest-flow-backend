import * as userService from "../services/user.service.js";

export const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const users = await userService.getUsers({ sector: req.query.sector });
    return res.status(200).json(users);
  } catch (error) {
    return next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.params.id, req.user, req.body);
    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
};

export const disableUser = async (req, res, next) => {
  try {
    await userService.disableUser(req.params.id);
    return res.status(200).json({ message: "User disabled" });
  } catch (error) {
    return next(error);
  }
};