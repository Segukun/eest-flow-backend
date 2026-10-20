import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";
import { buildResetCodeEmail, sendEmail } from "../utils/mailer.js";

const RESET_TTL_MS = 10 * 60 * 1000;

const sha256 = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const normalizeEmail = (email) => String(email).trim().toLowerCase();

// Genera un código de 6 dígitos (100000-999999) y lo guarda hasheado con su vencimiento. Reutilizado por "forgot" y "resend".
const assignResetCode = async (user) => {
  const code = String(crypto.randomInt(100000, 1000000));

  user.resetCode = sha256(code);
  user.resetCodeExpires = new Date(Date.now() + RESET_TTL_MS);
  await user.save();

  await sendEmail({ to: user.email, ...buildResetCodeEmail(code) });
};

export const login = async (userData) => {
  const user = await User.findOne({ email: userData.email }).select(
    "+password",
  );
  if (!user) throw new ApiError(404, "User or password incorrect");

  const isPasswordValid = await user.comparePassword(userData.password);

  if (!isPasswordValid) {
    throw new ApiError(401, "User or password incorrect");
  }
  if (!user.active) {
    throw new ApiError(403, "User is not active");
  }
  const token = jwt.sign(
    { id: user._id, accountType: user.accountType },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    },
  );

  user.password = undefined;

  return { user, token };
};

export const createAccount = async (userData) => {
  const existingUser = await User.findOne({ email: userData.email });
  if (existingUser) {
    throw new ApiError(409, "Email already exists");
  }

  const hashedPassword = await bcrypt.hash(
    userData.password,
    Number(process.env.SALT_ROUNDS),
  );
  const user = new User({ ...userData, password: hashedPassword });

  await user.save();

  user.password = undefined;

  return user;
};

export const forgotPassword = async ({ email }) => {
  const user = await User.findOne({ email: normalizeEmail(email) });

  if (!user) {
    return { existe: false };
  }

  await assignResetCode(user);
  return { existe: true };
};

export const resendCode = async ({ email }) => {
  const user = await User.findOne({ email: normalizeEmail(email) });

  if (user) {
    await assignResetCode(user);
    return { ok: true };
  }

  return {ok: false}
};

export const verifyCode = async ({ email, code }) => {
  const user = await User.findOne({ email: normalizeEmail(email) }).select(
    "+resetCode +resetCodeExpires",
  );

  const isValidCode =
    !!user &&
    !!user.resetCode &&
    !!user.resetCodeExpires &&
    user.resetCodeExpires.getTime() > Date.now() &&
    user.resetCode === sha256(code);

  if (!isValidCode) {
    return { valido: false };
  }

  const resetToken = crypto.randomBytes(32).toString("hex");

  user.resetPasswordToken = sha256(resetToken);
  user.resetPasswordExpires = new Date(Date.now() + RESET_TTL_MS);
  user.resetCode = undefined;
  user.resetCodeExpires = undefined;
  await user.save();

  return { valido: true, resetToken };
};

export const changePassword = async ({ email, resetToken, newPassword }) => {
  const user = await User.findOne({ email: normalizeEmail(email) }).select(
    "+password +resetPasswordToken +resetPasswordExpires +resetCode +resetCodeExpires",
  );

  const isValidToken =
    !!user &&
    !!user.resetPasswordToken &&
    !!user.resetPasswordExpires &&
    user.resetPasswordExpires.getTime() > Date.now() &&
    user.resetPasswordToken === sha256(resetToken);

  if (!isValidToken) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  user.password = await bcrypt.hash(
    newPassword,
    Number(process.env.SALT_ROUNDS),
  );
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.resetCode = undefined;
  user.resetCodeExpires = undefined;
  await user.save();

  return { ok: true };
};

export const refreshToken = async () => {};
