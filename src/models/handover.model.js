import mongoose from "mongoose";

const handoverSchema = new mongoose.Schema(
  {
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Claim",
      index: true,
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      index: true,
    },
    itemTitle: {
      type: String,
      required: true,
      trim: true,
    },
    itemCategory: {
      type: String,
      default: "Valuables",
    },
    itemThumbnail: {
      type: String,
      default: "",
    },
    owner: {
      userId: { type: String, required: true, index: true },
      name: { type: String, required: true },
      email: { type: String, required: true, index: true },
      avatar: { type: String, default: "/default-avatar.png" },
      role: { type: String, default: "owner" },
    },
    finder: {
      userId: { type: String, required: true, index: true },
      name: { type: String, required: true },
      email: { type: String, required: true, index: true },
      phone: { type: String, default: "" },
      avatar: { type: String, default: "/default-avatar.png" },
      role: { type: String, default: "finder" },
    },
    proposedBy: {
      type: String,
      enum: ["owner", "finder"],
      default: "finder",
    },
    meetingDate: {
      type: String,
      required: true,
    },
    timeSlot: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    safetyNote: {
      type: String,
      default: "Always meet in a well-lit, public place.",
    },
    status: {
      type: String,
      enum: ["proposed", "confirmed", "completed", "reunited"],
      default: "proposed",
      index: true,
    },
    confirmations: {
      ownerConfirmed: { type: Boolean, default: false },
      finderConfirmed: { type: Boolean, default: false },
      ownerConfirmedAt: { type: Date, default: null },
      finderConfirmedAt: { type: Date, default: null },
    },
    history: [
      {
        at: { type: Date, default: Date.now },
        by: { type: String },
        action: { type: String },
      },
    ],
    suspiciousFlags: [{ type: String }],
    adminWarnings: [
      {
        id: { type: String },
        target: { type: String, enum: ["finder", "receiver", "both"] },
        title: { type: String },
        message: { type: String },
        severity: { type: String, default: "high" },
        sentAt: { type: Date, default: Date.now },
      },
    ],
    ratingsUnlocked: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

handoverSchema.index({ "owner.userId": 1, status: 1 });
handoverSchema.index({ "finder.userId": 1, status: 1 });
handoverSchema.index({ createdAt: -1 });

const Handover = mongoose.model("Handover", handoverSchema);

export default Handover;
