import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    category: {
      type: String,
      enum: ["system", "forum", "task"],
      required: true,
    },
    type: { type: String, required: true, trim: true, maxlength: 60 }, // ej: "task_assigned"
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    link: { type: String, trim: true, default: "" },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    // evita duplicados en eventos repetibles (ej: vencimiento de la misma tarea)
    dedupeKey: { type: String, default: undefined },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index(
  { recipient: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } },
);

export default mongoose.model("Notification", notificationSchema);
