import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected MongoDB");
  } catch (error) {
    console.error("Could not connect to MongoDB", error);
  }
};
