
import mongoose from "mongoose";

const sectorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: [50, "name must be at most 50 characters long"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "description must be at most 200 characters long"],
      default: "",
    },
    color: {
      type: String,
      required: true,
      trim: true,
      match: [/^(#[0-9A-Fa-f]{3,8}|var\(--[\w-]+\))$/, "invalid color format"],
    },
    icon: {
      type: String,
      trim: true,
      default: "FiUsers",
    },

    // public: el usuario puede unirse directamente.
    // request: necesita aprobación de un administrador.
    accessMode: {
      type: String,
      enum: ["public", "request"],
      default: "public",
    },

    // Contador interno para serializar solicitudes con cambios de accessMode.
    joinRequestVersion: {
      type: Number,
      default: 0,
      select: false,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Sector", sectorSchema);
