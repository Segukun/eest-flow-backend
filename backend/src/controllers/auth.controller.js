import * as authService from "../services/auth.service.js";

export async function login(req, res, next) {
  res.status(200).json({ message: "Login" });
}

export async function createAccount(req, res, next) {
  res.status(200).json({ message: "Crear cuenta" });
}

export async function refreshToken(req, res, next) {
  res.status(200).json({ message: "Actualizar token" });
}

export async function logout(req, res, next) {
  res.status(200).json({ message: "Logout" });
}
