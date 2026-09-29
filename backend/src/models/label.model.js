import mongoose from "mongoose";

const labelSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      maxlength: 30,
      default: "",
    },
    color: {
      type: String,
      required: true,
      trim: true,
      match: [/^(#[0-9A-Fa-f]{3,8}|var\(--[\w-]+\))$/, "invalid color format"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Label", labelSchema);
