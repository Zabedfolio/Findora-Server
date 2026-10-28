import mongoose from "mongoose";

const handoverSchema = new mongoose.Schema(
  {
    claimId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Claim",
      index: true,
    },
    reportId: {
      type: mongoose.Schema.Types.Mixed,
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
    handoverCode: {
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
      default: "",
    },
    timeSlot: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    safetyNote: {
      type: String,
      default: "Always meet in a well-lit, public place.",
    },
    status: {
      type: String,
      enum: [
        "pending_proposal",
        "proposed",
        "counter_proposed",
        "confirmed",
        "completed",
        "reunited",
        "cancelled",
      ],
      default: "pending_proposal",
      index: true,
    },
    counterProposal: {
      meetingDate: { type: String, default: "" },
      timeSlot: { type: String, default: "" },
      location: { type: String, default: "" },
      safetyNote: { type: String, default: "" },
      suggestedBy: { type: String, default: "owner" },
      suggestedAt: { type: Date, default: null },
      status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
    },
    riskyLocationReports: [
      {
        reportedBy: { type: String },
        role: { type: String },
        reason: { type: String },
        reportedAt: { type: Date, default: Date.now },
      },
    ],
    hasWarning: {
      type: Boolean,
      default: false,
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
    isReviewed: {
      type: Boolean,
      default: false,
      index: true,
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
