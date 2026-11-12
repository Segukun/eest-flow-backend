
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },

    // Permite mostrar acciones de aprobar/rechazar.
    joinRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SectorJoinRequest",
      default: null,
    },

    // Las solicitudes pendientes no caducan.
    // Las demás mantienen una retención de 60 días.
    expiresAt: {
      type: Date,
      default: function () {
        return this.joinRequest
          ? null
          : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      },
    },

    actionStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: null,
    },

    category: {
      type: String,
      enum: ["system", "forum", "task"],
      required: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    link: {
      type: String,
      trim: true,
      default: "",
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    dedupeKey: {
      type: String,
      default: undefined,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ post: 1 });
notificationSchema.index({ joinRequest: 1 });

notificationSchema.index(
  { recipient: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: "string" } },
  },
);

export default mongoose.model("Notification", notificationSchema);
