import mongoose from "mongoose";

const readBySchema = new mongoose.Schema(
  {
    odooId: {
      type: String,
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    applicationId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    sender: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    type: {
      type: String,
      enum: ["text", "system"],
      default: "text",
    },
    readBy: {
      type: [readBySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient message retrieval by room
messageSchema.index({ roomId: 1, createdAt: -1 });
// Index for efficient message retrieval by application
messageSchema.index({ applicationId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;

