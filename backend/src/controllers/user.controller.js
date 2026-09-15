import * as userService from "../services/user.service.js";

export async function getUserById(req, res, next) {
  res.status(200).json({ message: "Usuario" });
}

export async function getUsers(req, res, next) {
  res.status(200).json({ message: "Usuarios" });
}

export async function updateUser(req, res, next) {
  res.status(200).json({ message: "Usuario actualizado" });
}

export async function disableUser(req, res, next) {
  res.status(200).json({ message: "Desactivar el usuario" });
}
