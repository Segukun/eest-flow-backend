
import mongoose from "mongoose";

const sectorJoinRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sector",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      required: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionSource: {
      type: String,
      enum: ["admin", "sector_public"],
      default: null,
    },
  },
  { timestamps: true },
);

// Una solicitud pendiente por usuario y sector.
sectorJoinRequestSchema.index(
  { user: 1, sector: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
    name: "one_pending_request_per_user_sector",
  },
);

sectorJoinRequestSchema.index({ sector: 1, status: 1, createdAt: -1 });
sectorJoinRequestSchema.index({ user: 1, status: 1, createdAt: -1 });

export default mongoose.model("SectorJoinRequest", sectorJoinRequestSchema);
