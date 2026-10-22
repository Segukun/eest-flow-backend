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

    // valida que todos los sectors enviados existan y estén activos antes de tocar la base de usuarios
    await sectorService.validateSectorsExist(sectors);

    const result = await authService.createAccount({
      name,
      email,
      password,
      sectors,
    });

    return res.status(200).json({
      message: "Account created",
      user: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    const result = await authService.forgotPassword({ email });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function resendCode(req, res, next) {
  try {
    const { email } = req.body;

    const result = await authService.resendCode({ email });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function verifyCode(req, res, next) {
  try {
    const { email, code } = req.body;

    const result = await authService.verifyCode({ email, code });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { email, resetToken, newPassword } = req.body;

    const result = await authService.changePassword({
      email,
      resetToken,
      newPassword,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { newPassword } = req.body;

    const result = await authService.changeCurrentPassword({
      userId: req.user._id,
      newPassword,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function refreshToken(req, res, next) {
  return res.status(200).json({ message: "Actualizar token" });
}
