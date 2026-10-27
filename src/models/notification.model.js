import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: String,
      required: true,
      index: true,
    },
    recipientEmail: {
      type: String,
      index: true,
      default: "",
    },
    sender: {
      userId: { type: String, default: "system" },
      name: { type: String, default: "Findora System" },
      avatar: { type: String, default: "/default-avatar.png" },
    },
    type: {
      type: String,
      enum: [
        "claim_received",
        "claim_approved",
        "claim_rejected",
        "handover_proposed",
        "handover_confirmed",
        "handover_completed",
        "radar_match",
        "admin_warning",
        "system",
      ],
      required: true,
      default: "system",
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      default: "",
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });

const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
export default Notification;
