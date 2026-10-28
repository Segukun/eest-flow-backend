import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      maxlength: 500,
    },

    assignedUser: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: null,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    state: {
      type: String,
      enum: ["pending", "in_progress", "review", "completed"],
      default: "pending",
    },

    // orden vertical dentro de (category + state); menor = más arriba
    position: {
      type: Number,
      default: 0,
    },

    labels: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Label" }],
      default: [],
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

taskSchema.index({ category: 1, state: 1, position: 1 });

export default mongoose.model("Task", taskSchema);