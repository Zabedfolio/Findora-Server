import Review from "../models/review.model.js";
import Handover from "../models/handover.model.js";

// Get reviews (public testimonials, user profile reviews, or admin moderation)
export const getReviews = async (req, res) => {
  try {
    const { status, targetUserId, reviewerId, limit = 20, page = 1 } = req.query;

    const filter = {};
    if (status && status !== "all") {
      filter.status = status;
    } else if (!status) {
      // Default to published reviews for public consumption
      filter.status = "published";
    }

    if (targetUserId) {
      filter["targetUser.userId"] = targetUserId;
    }
    if (reviewerId) {
      filter["reviewer.userId"] = reviewerId;
    }

    const numLimit = Math.min(Number(limit) || 20, 100);
    const numPage = Math.max(Number(page) || 1, 1);
    const skip = (numPage - 1) * numLimit;

    const [reviews, totalCount, countsResult] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(numLimit),
      Review.countDocuments(filter),
      Review.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const counts = {
      all: 0,
      published: 0,
      flagged: 0,
      hidden: 0,
    };
    countsResult.forEach((c) => {
      if (counts[c._id] !== undefined) {
        counts[c._id] = c.count;
      }
      counts.all += c.count;
    });

    // Calculate average rating if targetUserId specified
    let avgRating = 5.0;
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
      avgRating = Number((sum / reviews.length).toFixed(1));
    }

    res.status(200).json({
      success: true,
      data: reviews,
      totalCount,
      totalPages: Math.ceil(totalCount / numLimit),
      currentPage: numPage,
      counts,
      averageRating: avgRating,
    });
  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new verified review
export const createReview = async (req, res) => {
  try {
    const { reviewer, targetUser, targetItem, handoverId, rating, comment } = req.body;

    if (!reviewer || !reviewer.userId || !reviewer.name) {
      return res.status(400).json({ success: false, message: "Reviewer information is required" });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5 stars" });
    }
    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Review comment is required" });
    }

    // Pipeline Check: Handover ID is required to verify custody exchange
    if (!handoverId) {
      return res.status(403).json({
        success: false,
        message: "Reviews can only be submitted for verified, completed handovers. No random reviews allowed.",
      });
    }

    let handover = null;
    if (typeof handoverId === "string" && handoverId.match(/^[0-9a-fA-F]{24}$/)) {
      handover = await Handover.findById(handoverId);
    } else {
      handover = await Handover.findOne({ $or: [{ _id: handoverId }, { id: handoverId }] });
    }

    if (!handover) {
      return res.status(404).json({
        success: false,
        message: "Associated handover record not found.",
      });
    }

    // Pipeline Check 1: Handover must be completed and mutually confirmed by BOTH parties
    const isOwnerConfirmed = Boolean(handover.confirmations?.ownerConfirmed);
    const isFinderConfirmed = Boolean(handover.confirmations?.finderConfirmed);

    if (handover.status !== "completed" || !isOwnerConfirmed || !isFinderConfirmed) {
      return res.status(403).json({
        success: false,
        message:
          "Handover exchange has not been mutually confirmed by both parties yet. Reviews unlock only after both parties verify completion.",
      });
    }

    // Pipeline Check 2: Only the verified receiver (owner) can review the finder
    const reviewerId = String(reviewer.userId || "").toLowerCase();
    const reviewerEmail = String(reviewer.email || "").toLowerCase();
    const ownerId = String(handover.owner?.userId || "").toLowerCase();
    const ownerEmail = String(handover.owner?.email || "").toLowerCase();

    const isAuthorizedReceiver =
      (reviewerId && ownerId && reviewerId === ownerId) ||
      (reviewerEmail && ownerEmail && reviewerEmail === ownerEmail);

    if (!isAuthorizedReceiver) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized: Only the verified receiver who received this item can submit a review for the finder.",
      });
    }

    // Pipeline Check 3: Prevent duplicate reviews for the same exchange
    const existingReview = await Review.findOne({
      handoverId: handover._id,
      "reviewer.userId": reviewer.userId,
    });

    if (existingReview || handover.isReviewed) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted a verified review for this handover exchange.",
      });
    }

    // Resolve target finder
    const resolvedTargetUser = {
      userId: handover.finder?.userId || targetUser?.userId || "",
      name: handover.finder?.name || targetUser?.name || "Item Finder",
      email: handover.finder?.email || targetUser?.email || "",
    };

    const resolvedTargetItem = {
      itemId: handover.reportId || targetItem?.itemId || null,
      title: handover.itemTitle || targetItem?.title || "Returned Item",
    };

    const review = await Review.create({
      reviewer: {
        userId: reviewer.userId,
        name: reviewer.name,
        email: reviewer.email || "",
        avatar: reviewer.avatar || "/default-avatar.png",
        role: "Verified Item Receiver",
      },
      targetUser: resolvedTargetUser,
      targetItem: resolvedTargetItem,
      handoverId: handover._id,
      isVerifiedReturn: true,
      rating: Number(rating),
      comment: comment.trim(),
      status: "published",
    });

    // Mark handover as reviewed
    handover.isReviewed = true;
    await handover.save();

    res.status(201).json({
      success: true,
      message: "Verified review submitted successfully! It now appears on the finder's public profile.",
      data: review,
    });
  } catch (error) {
    console.error("Create review error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Moderate review (Admin action: approve, flag, or hide)
export const moderateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, flagReason } = req.body;

    if (!["published", "flagged", "hidden"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    review.status = status;
    if (flagReason !== undefined) {
      review.flagReason = flagReason;
    }

    await review.save();

    res.status(200).json({
      success: true,
      message: `Review status updated to ${status}`,
      data: review,
    });
  } catch (error) {
    console.error("Moderate review error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Report review as abusive or inappropriate
export const reportReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    review.reportCount = (review.reportCount || 0) + 1;
    if (review.reportCount >= 2) {
      review.status = "flagged";
      review.flagReason = reason || "Community reported for moderation review";
    }

    await review.save();

    res.status(200).json({
      success: true,
      message: "Review report submitted. Our safety team will review it.",
      data: review,
    });
  } catch (error) {
    console.error("Report review error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Permanently delete a review (Admin action)
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findByIdAndDelete(id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    res.status(200).json({
      success: true,
      message: "Review permanently deleted",
    });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

