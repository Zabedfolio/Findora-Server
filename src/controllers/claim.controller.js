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

    if (claimData.itemId && !claimData.reportId) {
      claimData.reportId = claimData.itemId;
    }

    // Try to auto-populate item and finder details from the database if reportId is present
    if (claimData.reportId) {
      try {
        let item = null;
        if (claimData.reportId.match(/^[0-9a-fA-F]{24}$/)) {
          item = await Item.findById(claimData.reportId);
        } else {
          item = await Item.findOne({ id: claimData.reportId });
        }

        if (item) {
          if (!claimData.itemTitle || claimData.itemTitle === "Reported Item") {
            claimData.itemTitle = item.title;
          }
          if (!claimData.itemThumbnail) {
            claimData.itemThumbnail = item.images?.[0] || "";
          }
          if (!claimData.category) {
            claimData.category = item.category || "General";
          }
          if (!claimData.location) {
            claimData.location = item.location || "";
          }
          if (item.postedBy) {
            claimData.finder = {
              userId: item.postedBy.userId || item.postedBy._id || claimData.finder?.userId || "finder",
              name: item.postedBy.name || claimData.finder?.name || "Item Finder",
              email: item.postedBy.email || claimData.finder?.email || "",
              phone: item.contact?.phone || claimData.finder?.phone || "",
              avatar: item.postedBy.image || claimData.finder?.avatar || "/default-avatar.png",
            };
          }
        }
      } catch (itemLookupErr) {
        console.warn("Item lookup during claim creation skipped:", itemLookupErr.message);
      }
    }

    // Support both id and userId for claimant
    if (claimData.claimant) {
      claimData.claimant.userId =
        claimData.claimant.userId || claimData.claimant.id || claimData.claimant._id || "usr_claimant";
      claimData.claimant.name = claimData.claimant.name || "Claimant";
      claimData.claimant.email = (claimData.claimant.email || "").toLowerCase();
      claimData.claimant.avatar = claimData.claimant.avatar || "/default-avatar.png";
    } else {
      claimData.claimant = { userId: "usr_claimant", name: "Claimant", email: "", avatar: "/default-avatar.png" };
    }

    // Support both id and userId for finder
    if (claimData.finder) {
      claimData.finder.userId =
        claimData.finder.userId || claimData.finder.id || claimData.finder._id || "usr_finder";
      claimData.finder.name = claimData.finder.name || "Finder";
      claimData.finder.email = (claimData.finder.email || "").toLowerCase();
      claimData.finder.avatar = claimData.finder.avatar || "/default-avatar.png";
    } else {
      claimData.finder = { userId: "usr_finder", name: "Finder", email: "", avatar: "/default-avatar.png" };
    }

    // Map description / proofText to claimantProof
    const proofDesc =
      claimData.proofText ||
      claimData.description ||
      (claimData.claimantProof && claimData.claimantProof.description) ||
      "Verification proof details submitted by claimant.";

    const proofPhoto =
      claimData.proofPhotoUrl ||
      claimData.proofImage ||
      (claimData.claimantProof && claimData.claimantProof.proofPhotoUrl) ||
      "";

    const addProof =
      claimData.additionalProof ||
      claimData.lostLocationTime ||
      (claimData.claimantProof && claimData.claimantProof.additionalProof) ||
      "";

    claimData.claimantProof = {
      description: proofDesc,
      proofPhotoUrl: proofPhoto,
      additionalProof: addProof,
      secretAnswers: claimData.secretAnswers || (claimData.claimantProof?.secretAnswers) || [],
      submittedAt: new Date(),
    };

    if (!claimData.timeline || claimData.timeline.length === 0) {
      claimData.timeline = [
        {
          step: 1,
          title: "Claim Submitted",
          time: "Just now",
          description: "Ownership proof submitted to the finder.",
          completed: true,
          current: true,
        },
      ];
    }

    const claim = await Claim.create(claimData);

    // Increment claimCount on the Item if valid ObjectId
    if (claim.reportId && String(claim.reportId).match(/^[0-9a-fA-F]{24}$/)) {
      try {
        await Item.findByIdAndUpdate(claim.reportId, { $inc: { claimCount: 1 } });
      } catch {}
    }

    const claimObj = claim.toObject();
    claimObj.id = claim._id.toString();

    res.status(201).json({
      success: true,
      message: "Ownership claim submitted successfully",
      data: claimObj,
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

    const andConditions = [];

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
      if (outMatches.length > 0) andConditions.push({ $or: outMatches });
    } else if (type === "incoming") {
      const inMatches = [];
      if (userId) inMatches.push({ "finder.userId": userId });
      if (email) inMatches.push({ "finder.email": email.toLowerCase() });
      if (inMatches.length > 0) andConditions.push({ $or: inMatches });
    } else {
      if (userMatches.length > 0) andConditions.push({ $or: userMatches });
    }

    const filter = {};

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
      andConditions.push({
        $or: [
          { itemTitle: { $regex: q.trim(), $options: "i" } },
          { claimNumber: { $regex: q.trim(), $options: "i" } },
          { location: { $regex: q.trim(), $options: "i" } },
        ],
      });
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    const rawClaims = await Claim.find(filter).sort({ createdAt: -1 });
    const claims = rawClaims.map((c) => {
      const obj = c.toObject();
      obj.id = c._id.toString();
      return obj;
    });

    const userBaseFilter = andConditions.length > 0 ? { $or: userMatches } : {};
    const allUserClaims = await Claim.find(userBaseFilter).select("status");

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

// Get single claim by ID
export const getClaimById = async (req, res) => {
  try {
    const { id } = req.params;
    const claim = await Claim.findById(id);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Claim not found" });
    }
    res.status(200).json({ success: true, data: claim });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update claim (e.g. proof, notes, status)
export const updateClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    const claim = await Claim.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!claim) {
      return res.status(404).json({ success: false, message: "Claim not found" });
    }

    res.status(200).json({
      success: true,
      message: "Claim updated successfully",
      data: claim,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete / Cancel claim
export const deleteClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const claim = await Claim.findByIdAndDelete(id);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Claim not found" });
    }

    // Decrement claimCount on Item
    if (claim.reportId) {
      try {
        await Item.findByIdAndUpdate(claim.reportId, { $inc: { claimCount: -1 } });
      } catch {}
    }

    res.status(200).json({
      success: true,
      message: "Claim cancelled successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Submit additional proof
export const submitAdditionalProof = async (req, res) => {
  try {
    const { id } = req.params;
    const { proofText } = req.body;

    const claim = await Claim.findById(id);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Claim not found" });
    }

    claim.status = "pending";
    claim.statusLabel = "Under Review";
    claim.statusDescription = "Additional details submitted! Finder is re-evaluating your ownership claim.";
    claim.claimantProof.additionalProof = proofText || "";
    claim.claimantProof.submittedAt = new Date();

    claim.timeline.push({
      step: claim.timeline.length + 1,
      title: "Additional Details Provided",
      time: "Just now",
      description: proofText || "Additional verification proof attached.",
      completed: true,
      current: true,
    });

    await claim.save();

    res.status(200).json({
      success: true,
      message: "Additional proof submitted successfully",
      data: claim,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark claim as reunited & returned
export const markClaimReunited = async (req, res) => {
  try {
    const { id } = req.params;

    const claim = await Claim.findById(id);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Claim not found" });
    }

    claim.status = "reunited";
    claim.statusLabel = "Reunited & Returned";
    claim.statusDescription = "Item was successfully handed over and verified by both parties.";
    if (!claim.handover) claim.handover = {};
    claim.handover.status = "completed";
    claim.handover.completedAt = new Date();

    claim.timeline.push({
      step: claim.timeline.length + 1,
      title: "Reunited & Confirmed",
      time: "Just now",
      description: "Both parties verified item return.",
      completed: true,
      current: true,
    });

    await claim.save();

    // Mark the Item as resolved too
    if (claim.reportId && String(claim.reportId).match(/^[0-9a-fA-F]{24}$/)) {
      try {
        await Item.findByIdAndUpdate(claim.reportId, { status: "resolved" });
      } catch {}
    }

    res.status(200).json({
      success: true,
      message: "Claim marked as reunited",
      data: claim,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

