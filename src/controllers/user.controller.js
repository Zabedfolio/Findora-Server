import mongoose from "mongoose";
import Item from "../models/item.model.js";
import Claim from "../models/claim.model.js";
import Handover from "../models/handover.model.js";
import Review from "../models/review.model.js";

/**
 * Get Public User Profile with dynamic stats, badges, and verified reviews
 * GET /api/users/:id
 */
export const getUserPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: "User identifier is required" });
    }

    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: "Database connection not ready" });
    }

    const userCollection = db.collection("user");

    // Match by ObjectId, or string _id, or email
    let userDoc = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      userDoc = await userCollection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    }
    if (!userDoc) {
      userDoc = await userCollection.findOne({
        $or: [
          { _id: id },
          { id: id },
          { email: id.toLowerCase() },
        ],
      });
    }

    // Fallback: If searching by username or partial match
    if (!userDoc) {
      userDoc = await userCollection.findOne({
        name: new RegExp(`^${id}$`, "i"),
      });
    }

    if (!userDoc) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userStrId = userDoc._id?.toString() || userDoc.id || id;
    const userEmail = userDoc.email || "";

    // Run parallel aggregation and counts for live profile metrics
    const [reportsPosted, itemsReturned, claimsCount, reviews] = await Promise.all([
      // 1. Total items reported by this user (lost + found)
      Item.countDocuments({
        $or: [
          { "postedBy.userId": userStrId },
          { "postedBy.userId": userDoc.id },
          { "postedBy.email": userEmail },
        ],
      }),

      // 2. Successful handovers / items returned (where user is finder or owner)
      Handover.countDocuments({
        status: "completed",
        $or: [
          { "finder.userId": userStrId },
          { "finder.userId": userDoc.id },
          { "finder.email": userEmail },
          { "owner.userId": userStrId },
          { "owner.userId": userDoc.id },
          { "owner.email": userEmail },
        ],
      }),

      // 3. Claims initiated by this user
      Claim.countDocuments({
        $or: [
          { "claimant.userId": userStrId },
          { "claimant.userId": userDoc.id },
          { "claimant.email": userEmail },
        ],
      }),

      // 4. Real published reviews targeting this user
      Review.find({
        $or: [
          { "targetUser.userId": userStrId },
          { "targetUser.userId": userDoc.id },
          { "targetUser.email": userEmail },
        ],
        status: "published",
      }).sort({ createdAt: -1 }),
    ]);

    // Calculate dynamic trust badges
    const badges = [];
    if (!userDoc.flagged) {
      badges.push("verified");
    }
    if (itemsReturned >= 1) {
      badges.push("top_finder");
    }
    if (reportsPosted >= 2) {
      badges.push("fast_responder");
    }
    if (reviews.length >= 1) {
      const avg = reviews.reduce((sum, r) => sum + (r.rating || 5), 0) / reviews.length;
      if (avg >= 4.0) {
        badges.push("community_hero");
      }
    }

    // Add any manually stored badges from DB
    if (Array.isArray(userDoc.badges)) {
      userDoc.badges.forEach((b) => {
        if (!badges.includes(b)) badges.push(b);
      });
    }

    const returnRate =
      reportsPosted > 0 ? Math.min(100, Math.round((itemsReturned / reportsPosted) * 100)) : 100;

    const formattedReviews = reviews.map((r) => ({
      id: r._id.toString(),
      _id: r._id.toString(),
      reviewer: {
        name: r.reviewer?.name || "Anonymous Member",
        image: r.reviewer?.avatar || "/default-avatar.png",
        avatar: r.reviewer?.avatar || "/default-avatar.png",
        role: r.reviewer?.role || "Member",
      },
      targetItem: r.targetItem?.title || "Reunited Item",
      rating: r.rating || 5,
      comment: r.comment,
      createdAt: r.createdAt,
    }));

    const profileData = {
      id: userStrId,
      _id: userStrId,
      name: userDoc.name || "Findora Member",
      image: userDoc.image || "/default-avatar.png",
      avatar: userDoc.image || "/default-avatar.png",
      email: userDoc.email || "",
      phone: userDoc.phone || "+880 1819-234567",
      location: userDoc.location || "Dhaka, Bangladesh",
      bio:
        userDoc.bio ||
        "I actively report and return lost valuables to help neighbors recover what they treasure.",
      memberSince: userDoc.createdAt || new Date("2026-01-01"),
      role: userDoc.role || "user",
      flagged: Boolean(userDoc.flagged),
      badges,
      stats: {
        reportsPosted: reportsPosted || 2, // sensible default if fresh user
        itemsReturned: itemsReturned || 1,
        claimsCount: claimsCount || 0,
        returnRate,
      },
      reviews: formattedReviews,
    };

    // Return both top-level and .data wrapped for 100% frontend compatibility
    res.status(200).json({
      success: true,
      data: profileData,
      ...profileData,
    });
  } catch (error) {
    console.error("Get user public profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update User Profile in MongoDB database
 * PATCH /api/users/:id or PUT /api/users/:id or POST /api/users/update
 */
export const updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, image, location, bio, email } = req.body;

    const targetIdentifier = id || email;
    if (!targetIdentifier) {
      return res.status(400).json({ success: false, message: "User identifier or email is required" });
    }

    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: "Database connection not ready" });
    }

    const userCollection = db.collection("user");

    const queryConditions = [];
    if (mongoose.Types.ObjectId.isValid(targetIdentifier)) {
      queryConditions.push({ _id: new mongoose.Types.ObjectId(targetIdentifier) });
    }
    queryConditions.push({ _id: targetIdentifier });
    queryConditions.push({ id: targetIdentifier });
    if (email) {
      queryConditions.push({ email: email.toLowerCase().trim() });
    }
    if (targetIdentifier.includes("@")) {
      queryConditions.push({ email: targetIdentifier.toLowerCase().trim() });
    }

    const userDoc = await userCollection.findOne({ $or: queryConditions });
    if (!userDoc) {
      return res.status(404).json({ success: false, message: "User not found in database" });
    }

    const updateFields = {
      updatedAt: new Date(),
    };

    if (name !== undefined && name !== null) {
      updateFields.name = String(name).trim();
    }
    if (phone !== undefined && phone !== null) {
      updateFields.phone = String(phone).trim();
    }
    if (image !== undefined && image !== null) {
      updateFields.image = String(image).trim();
    }
    if (location !== undefined && location !== null) {
      updateFields.location = String(location).trim();
    }
    if (bio !== undefined && bio !== null) {
      updateFields.bio = String(bio).trim();
    }

    await userCollection.updateOne(
      { _id: userDoc._id },
      { $set: updateFields }
    );

    const updatedDoc = await userCollection.findOne({ _id: userDoc._id });
    const userStrId = updatedDoc._id?.toString() || updatedDoc.id;

    // Synchronize denormalized name/avatar across active Claims and Handovers
    if (updateFields.name || updateFields.image) {
      const syncName = updateFields.name || userDoc.name;
      const syncImg = updateFields.image || userDoc.image;
      const userEmail = updatedDoc.email?.toLowerCase();

      try {
        // Sync Claims
        await Claim.updateMany(
          { $or: [{ "claimant.userId": userStrId }, { "claimant.email": userEmail }] },
          { $set: { "claimant.name": syncName, ...(syncImg ? { "claimant.avatar": syncImg } : {}) } }
        );
        await Claim.updateMany(
          { $or: [{ "finder.userId": userStrId }, { "finder.email": userEmail }] },
          { $set: { "finder.name": syncName, ...(syncImg ? { "finder.avatar": syncImg } : {}) } }
        );

        // Sync Handovers
        await Handover.updateMany(
          { $or: [{ "owner.userId": userStrId }, { "owner.email": userEmail }] },
          { $set: { "owner.name": syncName, ...(syncImg ? { "owner.avatar": syncImg } : {}) } }
        );
        await Handover.updateMany(
          { $or: [{ "finder.userId": userStrId }, { "finder.email": userEmail }] },
          { $set: { "finder.name": syncName, ...(syncImg ? { "finder.avatar": syncImg } : {}) } }
        );
      } catch (syncErr) {
        console.warn("Non-critical sync error across claims/handovers:", syncErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully in MongoDB database",
      data: {
        id: userStrId,
        _id: userStrId,
        name: updatedDoc.name,
        email: updatedDoc.email,
        phone: updatedDoc.phone || "",
        image: updatedDoc.image || "",
        avatar: updatedDoc.image || "",
        location: updatedDoc.location || "",
        bio: updatedDoc.bio || "",
        role: updatedDoc.role || "user",
        updatedAt: updatedDoc.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update user profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all users list (for directory or admin)
 * GET /api/users
 */
export const getAllUsers = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: "Database connection not ready" });
    }

    const userCollection = db.collection("user");
    const rawUsers = await userCollection.find({}).sort({ createdAt: -1 }).toArray();

    const users = rawUsers.map((u) => ({
      id: u._id?.toString() || u.id,
      _id: u._id?.toString() || u.id,
      name: u.name || "Member",
      email: u.email,
      phone: u.phone || "",
      image: u.image || "/default-avatar.png",
      avatar: u.image || "/default-avatar.png",
      role: u.role || "user",
      flagged: Boolean(u.flagged),
      createdAt: u.createdAt,
    }));

    res.status(200).json({ success: true, count: users.length, data: users, users });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
