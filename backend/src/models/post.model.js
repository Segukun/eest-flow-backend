import mongoose from "mongoose";

const contentBlockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["paragraph"],
      default: "paragraph",
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
  },
  { _id: false },
);

const attachmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["image", "file"],
      required: true,
    },

    url: {
      type: String,
      required: true,
      trim: true,
    },

    path: {
      type: String,
      required: true,
      trim: true,
    },

    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },

    mimeType: {
      type: String,
      required: true,
      trim: true,
    },

    size: {
      type: Number,
      required: true,
      min: 0,
    },
  },
);

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    sector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sector",
      required: true,
    },

    content: {
      type: [contentBlockSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length > 0,
        message: "post must contain at least one content block",
      },
    },

    attachments: {
      type: [attachmentSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: "post cannot contain more than 10 attachments",
      },
    },

    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

postSchema.index({ active: 1, createdAt: -1 });
postSchema.index({ sector: 1, createdAt: -1 });

export default mongoose.model("Post", postSchema);