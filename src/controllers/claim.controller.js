import Claim from "../models/claim.model.js";
import Handover from "../models/handover.model.js";
import Item from "../models/item.model.js";

// Create new claim
export const createClaim = async (req, res) => {
  try {
    const claimData = { ...req.body };
    if (!claimData.claimNumber) {
      claimData.claimNumber = `CLM-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    const claim = await Claim.create(claimData);

    // Increment claimCount on the Item
    if (claim.reportId) {
      await Item.findByIdAndUpdate(claim.reportId, { $inc: { claimCount: 1 } });
    }

    res.status(201).json({
      success: true,
      message: "Ownership claim submitted successfully",
      data: claim,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get claims for authenticated user (outgoing, incoming, or all)
export const getMyClaims = async (req, res) => {
  try {
    const { userId, email, type, status, q, category } = req.query;

    if (!userId && !email) {
      return res.status(200).json({
        success: true,
        claims: [],
        counts: { all: 0, in_handover: 0, pending: 0, needs_info: 0, reunited: 0, rejected: 0 },
      });
    }

    const filter = {};

    const userMatches = [];
    if (userId) {
      userMatches.push({ "claimant.userId": userId });
      userMatches.push({ "finder.userId": userId });
    }
    if (email) {
      userMatches.push({ "claimant.email": email.toLowerCase() });
      userMatches.push({ "finder.email": email.toLowerCase() });
    }

    if (type === "outgoing") {
      const outMatches = [];
      if (userId) outMatches.push({ "claimant.userId": userId });
      if (email) outMatches.push({ "claimant.email": email.toLowerCase() });
      filter.$or = outMatches;
    } else if (type === "incoming") {
      const inMatches = [];
      if (userId) inMatches.push({ "finder.userId": userId });
      if (email) inMatches.push({ "finder.email": email.toLowerCase() });
      filter.$or = inMatches;
    } else {
      filter.$or = userMatches;
    }

    if (status && status !== "all") {
      if (status === "actionable") {
        filter.status = { $in: ["approved", "in_handover", "needs_info"] };
      } else {
        filter.status = status;
      }
    }

    if (category && category !== "All Categories") {
      filter.category = category;
    }

    if (q && q.trim()) {
      filter.$or = [
        { itemTitle: { $regex: q.trim(), $options: "i" } },
        { claimNumber: { $regex: q.trim(), $options: "i" } },
        { location: { $regex: q.trim(), $options: "i" } },
      ];
    }

    const claims = await Claim.find(filter).sort({ createdAt: -1 });

    const allUserClaims = await Claim.find(filter.$or ? { $or: filter.$or } : {}).select("status");

    const counts = {
      all: allUserClaims.length,
      in_handover: allUserClaims.filter((c) => c.status === "in_handover" || c.status === "approved").length,
      pending: allUserClaims.filter((c) => c.status === "pending").length,
      needs_info: allUserClaims.filter((c) => c.status === "needs_info").length,
      reunited: allUserClaims.filter((c) => c.status === "reunited").length,
      rejected: allUserClaims.filter((c) => c.status === "rejected").length,
    };

    res.status(200).json({
      success: true,
      claims,
      counts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Approve claim
export const approveClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const claim = await Claim.findById(id);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Claim not found" });
    }

    const generatedOtp = `FP-${Math.floor(1000 + Math.random() * 9000)}`;
    claim.status = "approved";
    claim.statusLabel = "Approved - Ready for Handover";
    claim.statusDescription = "Finder verified your ownership claim! Safe handover ready.";
    claim.reviewNotes = note || "Finder confirmed proof and authorized handover.";
    claim.handover = {
      isEligible: true,
      status: "ready",
      handoverCode: generatedOtp,
      locationName: claim.location || "Designated Safe Exchange Spot",
      timeSlot: "Coordinate with finder to finalize time",
    };

    claim.timeline.push({
      step: claim.timeline.length + 1,
      title: "Claim Approved by Finder",
      time: "Just now",
      description: note || "Finder confirmed identifying proof.",
      completed: true,
      current: true,
    });

    await claim.save();

    // Auto-create or ensure handover record
    let handover = await Handover.findOne({ claimId: claim._id });
    if (!handover) {
      handover = await Handover.create({
        claimId: claim._id,
        reportId: claim.reportId,
        itemTitle: claim.itemTitle,
        itemCategory: claim.category,
        itemThumbnail: claim.itemThumbnail,
        owner: {
          userId: claim.claimant.userId,
          name: claim.claimant.name,
          email: claim.claimant.email,
          avatar: claim.claimant.avatar,
          role: "owner",
        },
        finder: {
          userId: claim.finder.userId,
          name: claim.finder.name,
          email: claim.finder.email,
          phone: claim.finder.phone,
          avatar: claim.finder.avatar,
          role: "finder",
        },
        proposedBy: "finder",
        meetingDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
        timeSlot: "Afternoon (03:30 PM - 05:00 PM)",
        location: claim.location || "Police Station Lobby / Public Safe Spot",
        safetyNote: note || "Meet inside public reception under security surveillance.",
        status: "proposed",
      });
    }

    res.status(200).json({
      success: true,
      message: "Claim approved and handover proposal initialized",
      data: claim,
      handover,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reject claim
export const rejectClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const claim = await Claim.findById(id);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Claim not found" });
    }

    claim.status = "rejected";
    claim.statusLabel = "Verification Declined";
    claim.statusDescription = note || "The finder concluded that details do not match the item.";
    claim.reviewNotes = note || "Verification details did not match the physical item.";

    claim.timeline.push({
      step: claim.timeline.length + 1,
      title: "Claim Declined",
      time: "Just now",
      description: note || "Proof details did not match.",
      completed: true,
      current: true,
    });

    await claim.save();

    res.status(200).json({
      success: true,
      message: "Claim declined",
      data: claim,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
