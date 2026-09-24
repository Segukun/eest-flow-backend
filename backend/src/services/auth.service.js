import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";

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

  delete user.password;

  return { user, token };
};

export const createAccount = async (userData) => {
  // Importante destacar que solo el admin puede crear cuentas
  const existingUser = await User.findOne({ email: userData.email });
  if (existingUser) {
    throw new ApiError(409, "Email already exists");
  }

  const hashedPassword = bcrypt.hashSync(
    userData.password,
    Number(process.env.SALT_ROUNDS),
  );
  const user = new User({ ...userData, password: hashedPassword });

  await user.save();
  return user;
};

export const changePassword = async () => {};

export const refreshToken = async () => {};
