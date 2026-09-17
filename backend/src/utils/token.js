import jwt from "jsonwebtoken";

export const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, accountType: user.accountType },
    process.env.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, accountType: user.accountType },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: "7d",
    },
  );
};
