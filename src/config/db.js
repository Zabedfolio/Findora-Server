import mongoose from "mongoose";
import Config from "./Config.js";

const ConnectedDB = async () => {
  try {
    const mongoDBUri = Config.MONGODB_URI;
    await mongoose.connect(mongoDBUri);
    console.log("MongoDB Connected Successfully! ✅");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
};

export default ConnectedDB;
