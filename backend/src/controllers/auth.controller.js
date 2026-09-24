import * as authService from "../services/auth.service.js";
import * as sectorService from "../services/sector.service.js";

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await authService.login({ email, password });

    return res
      .cookie("accessToken", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 1000,
      })
      .status(200)
      .json({
        message: "Login successful",
        ...result,
      });
  } catch (error) {
    return next(error);
  }
}

export async function logout(req, res, next) {
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  return res.status(200).json({
    message: "Logout successful",
  });
}

export async function createAccount(req, res, next) {
  try {
    const { name, email, password, sectors } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }
    if (!Array.isArray(sectors) || sectors.length === 0) {
      return res.status(400).json({ message: "At least one sector is required" });
    }

    // valida que todos los sectors enviados existan y estén activos
    // antes de tocar la base de usuarios
    await sectorService.validateSectorsExist(sectors);

    const result = await authService.createAccount({
      name,
      email,
      password,
      sectors,
    });

    return res.status(200).json({
      message: "Account created",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function refreshToken(req, res, next) {
  return res.status(200).json({ message: "Actualizar token" });
}