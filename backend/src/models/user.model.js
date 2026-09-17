import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [30, "name must be at most 30 characters long"],
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      maxlength: [50, "email must be at most 50 characters long"],
    },
    accountType: {
      type: String,
      required: true,
      enum: ["admin", "collaborator"],
      default: "collaborator",
    },
    sector: {
      type: String,
      required: true,
      enum: [
        "student_affairs",
        "secretary_office",
        "school_administration",
        "teachers",
      ], // Preceptoria, secretaria, direccion, profesores.
    },
    active: {
      type: Boolean,
      default: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true },
);

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);
