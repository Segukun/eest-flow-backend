import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    description: {
      type: String,
      required: true,
      maxlength: 500,
    },

    assignedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
      type: String,
      default: null,
    },

    state: {
      type: String,
      enum: ["pending", "in_progress", "review", "completed"],
      default: "pending",
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);
export default mongoose.model("Task", taskSchema);
