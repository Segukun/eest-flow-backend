import mongoose from "mongoose";

const taskAttachmentSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    path: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
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

    // Orden vertical dentro de (category + state); menor = más arriba.
    position: {
      type: Number,
      default: 0,
    },

    labels: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Label" }],
      default: [],
    },

    // Archivos adjuntos de la tarea.
    attachments: {
      type: [taskAttachmentSchema],
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