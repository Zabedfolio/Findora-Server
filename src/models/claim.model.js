import mongoose from "mongoose";

const claimSchema = new mongoose.Schema(
  {
    claimNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reportId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },
    itemTitle: {
      type: String,
      required: true,
      trim: true,
    },
    itemThumbnail: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "General",
    },
    location: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "in_handover", "needs_info", "reunited"],
      default: "pending",
      index: true,
    },
    statusLabel: {
      type: String,
      default: "Under Review",
    },
    statusDescription: {
      type: String,
      default: "Finder is reviewing proof of ownership.",
    },
    claimant: {
      userId: { type: String, required: true, index: true },
      name: { type: String, required: true },
      email: { type: String, required: true, index: true },
      avatar: { type: String, default: "/default-avatar.png" },
    },
    finder: {
      userId: { type: String, required: true, index: true },
      name: { type: String, required: true },
      email: { type: String, required: true, index: true },
      phone: { type: String, default: "" },
      avatar: { type: String, default: "/default-avatar.png" },
    },
    claimantProof: {
      description: { type: String, required: true },
      proofPhotoUrl: { type: String, default: "" },
      additionalProof: { type: String, default: "" },
      secretAnswers: [{ type: String }],
      submittedAt: { type: Date, default: Date.now },
    },
    reviewNotes: {
      type: String,
      default: "",
    },
    timeline: [
      {
        step: { type: Number },
        title: { type: String },
        time: { type: String },
        description: { type: String },
        completed: { type: Boolean, default: false },
        current: { type: Boolean, default: false },
      },
    ],
    handover: {
      isEligible: { type: Boolean, default: false },
      status: { type: String, default: "pending" },
      handoverCode: { type: String, default: "" },
      locationName: { type: String, default: "" },
      timeSlot: { type: String, default: "" },
      completedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

claimSchema.index({ "claimant.userId": 1, status: 1 });
claimSchema.index({ "finder.userId": 1, status: 1 });
claimSchema.index({ createdAt: -1 });

const Claim = mongoose.model("Claim", claimSchema);

export default Claim;
