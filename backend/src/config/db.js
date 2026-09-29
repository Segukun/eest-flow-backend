import mongoose from "mongoose";

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not defined");
  }

  try {
    await mongoose.connect(uri);
    console.log("Connected MongoDB");
  } catch (error) {
    console.error("Could not connect to MongoDB", error);
    throw error;
  }
};
