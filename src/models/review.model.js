import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    reviewer: {
      userId: { type: String, required: true },
      name: { type: String, required: true },
      email: { type: String, default: "" },
      avatar: { type: String, default: "/default-avatar.png" },
      role: { type: String, default: "Community Member" },
    },
    targetUser: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    targetItem: {
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
      title: { type: String, default: "" },
    },
    handoverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Handover",
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["published", "flagged", "hidden"],
      default: "published",
      index: true,
    },
    flagReason: {
      type: String,
      default: "",
    },
    reportCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

reviewSchema.index({ "reviewer.userId": 1 });
reviewSchema.index({ "targetUser.userId": 1 });
reviewSchema.index({ status: 1, createdAt: -1 });

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
export default Review;
