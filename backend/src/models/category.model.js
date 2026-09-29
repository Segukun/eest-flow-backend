import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: [25, "name must be at most 25 characters long"],
    },
    color: {
      type: String,
      required: true,
      trim: true,
      match: [/^(#[0-9A-Fa-f]{3,8}|var\(--[\w-]+\))$/, "invalid color format"],
    },
    sectors: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Sector" }],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "category must belong to at least one sector",
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Category", categorySchema);
