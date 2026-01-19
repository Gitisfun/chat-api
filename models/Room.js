import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 50,
    },
    description: {
      type: String,
      default: "",
      maxlength: 200,
    },
    applicationId: {
      type: String,
      required: true,
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    participants: [{
      type: String,
    }],
  },
  {
    timestamps: true,
  }
);

// Compound index for unique room name per application
roomSchema.index({ name: 1, applicationId: 1 }, { unique: true });

const Room = mongoose.model("Room", roomSchema);

export default Room;

