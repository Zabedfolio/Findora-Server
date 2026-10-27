import mongoose from "mongoose";

const fraudCaseSchema = new mongoose.Schema(
  {
    caseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    targetUser: {
      userId: { type: String, required: true },
      name: { type: String, required: true },
      email: { type: String, default: "" },
      avatar: { type: String, default: "/default-avatar.png" },
    },
    reportedBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "Automated AI Shield" },
      email: { type: String, default: "" },
    },
    targetType: {
      type: String,
      enum: ["claim", "handover", "item", "user", "review"],
      required: true,
      default: "claim",
    },
    targetId: {
      type: String,
      default: "",
    },
    triggerReason: {
      type: String,
      required: true,
    },
    riskScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      index: true,
    },
    evidence: {
      type: String,
      default: "",
    },
    deviceFingerprint: {
      type: String,
      default: "",
    },
    ipAddress: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["investigating", "actioned", "dismissed"],
      default: "investigating",
      index: true,
    },
    actionNotes: {
      type: String,
      default: "",
    },
    totalClaims: {
      type: Number,
      default: 1,
    },
    disputesCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

fraudCaseSchema.index({ "targetUser.userId": 1 });
fraudCaseSchema.index({ riskLevel: 1, status: 1 });

const FraudCase = mongoose.models.FraudCase || mongoose.model("FraudCase", fraudCaseSchema);
export default FraudCase;
