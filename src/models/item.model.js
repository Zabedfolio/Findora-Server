import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["lost", "found"],
      required: [true, "Item type is required"],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
    },
    images: [
      {
        type: String, // image URLs
      },
    ],
    status: {
      type: String,
      enum: ["active", "resolved", "claimed"],
      default: "active",
    },
    postedBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "Anonymous" },
      email: { type: String, default: "" },
      image: { type: String, default: "/default-avatar.png" },
    },
    contact: {
      phone: { type: String, default: "" },
      preferredMethod: {
        type: String,
        enum: ["phone", "email", "chat"],
        default: "email",
      },
    },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    claimCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // automatically adds createdAt and updatedAt
  },
);

itemSchema.index({ type: 1, status: 1 });
itemSchema.index({ "postedBy.userId": 1 });
itemSchema.index({ "postedBy.email": 1 });
itemSchema.index({ category: 1 });
itemSchema.index({ createdAt: -1 });

const Item = mongoose.model("Item", itemSchema);

export default Item;
