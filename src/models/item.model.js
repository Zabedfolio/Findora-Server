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
    // You can add postedBy later when you want to connect with BetterAuth user
  },
  {
    timestamps: true, // automatically adds createdAt and updatedAt
  },
);

const Item = mongoose.model("Item", itemSchema);

export default Item;
