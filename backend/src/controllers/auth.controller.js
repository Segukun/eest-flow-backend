import * as authService from "../services/auth.service.js";

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
    const { name, email, password, sector } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }
    if (!sector) {
      return res.status(400).json({ message: "Sector is required" });
    }

    const result = await authService.createAccount({
      name,
      email,
      password,
      sector,
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
