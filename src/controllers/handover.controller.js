import Handover from "../models/handover.model.js";
import Item from "../models/item.model.js";
import Claim from "../models/claim.model.js";

// Get handovers (user-filtered or platform-wide for admin)
export const getHandovers = async (req, res) => {
  try {
    const { userId, email, isAdmin, filter } = req.query;

    let queryFilter = {};

    if (isAdmin !== "true" && isAdmin !== true) {
      if (!userId && !email) {
        return res.status(200).json({
          success: true,
          all: [],
          upcoming: [],
          past: [],
          suspicious: [],
          counts: { all: 0, upcoming: 0, past: 0, proposed: 0, confirmed: 0, completed: 0, suspicious: 0 },
        });
      }

      const userConditions = [];
      if (userId) {
        userConditions.push({ "owner.userId": userId });
        userConditions.push({ "finder.userId": userId });
      }
      if (email) {
        userConditions.push({ "owner.email": email.toLowerCase() });
        userConditions.push({ "finder.email": email.toLowerCase() });
      }
      queryFilter.$or = userConditions;
    }

    const all = await Handover.find(queryFilter).sort({ createdAt: -1 });

    const upcoming = all.filter(
      (h) =>
        h.status === "pending_proposal" ||
        h.status === "proposed" ||
        h.status === "counter_proposed" ||
        h.status === "confirmed"
    );
    const past = all.filter((h) => h.status === "completed" || h.status === "reunited");
    const suspicious = all.filter(
      (h) =>
        (h.suspiciousFlags && h.suspiciousFlags.length > 0) ||
        (h.adminWarnings && h.adminWarnings.length > 0) ||
        h.hasWarning
    );

    let filtered = all;
    if (filter === "upcoming") filtered = upcoming;
    else if (filter === "past" || filter === "completed") filtered = past;
    else if (filter === "suspicious") filtered = suspicious;

    res.status(200).json({
      success: true,
      all: filtered,
      upcoming,
      past,
      suspicious,
      counts: {
        all: all.length,
        upcoming: upcoming.length,
        past: past.length,
        pending_proposal: all.filter((h) => h.status === "pending_proposal").length,
        proposed: all.filter((h) => h.status === "proposed").length,
        counter_proposed: all.filter((h) => h.status === "counter_proposed").length,
        confirmed: all.filter((h) => h.status === "confirmed").length,
        completed: past.length,
        suspicious: suspicious.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Finder creates/proposes initial meeting schedule
export const proposeHandover = async (req, res) => {
  try {
    const { id } = req.params;
    const { meetingDate, timeSlot, location, safetyNote } = req.body;

    const handover = await Handover.findById(id);
    if (!handover) {
      return res.status(404).json({ success: false, message: "Handover record not found" });
    }

    const locLower = (location || "").toLowerCase();
    const timeLower = (timeSlot || "").toLowerCase();
    const flags = [];
    if (locLower.includes("alley") || locLower.includes("depot") || locLower.includes("private") || locLower.includes("home")) {
      flags.push("Non-public or isolated venue detected");
    }
    if (timeLower.includes("11:") || timeLower.includes("12:") || timeLower.includes("01:") || timeLower.includes("night") || timeLower.includes("midnight")) {
      flags.push("Late night exchange scheduled");
    }

    handover.meetingDate = meetingDate || handover.meetingDate;
    handover.timeSlot = timeSlot || handover.timeSlot;
    handover.location = location || handover.location;
    handover.safetyNote = safetyNote || "Always meet in a well-lit, public place under security surveillance.";
    handover.proposedBy = "finder";
    handover.status = "proposed";
    if (flags.length > 0) {
      handover.suspiciousFlags = Array.from(new Set([...(handover.suspiciousFlags || []), ...flags]));
    }
    handover.history.push({
      at: new Date(),
      by: "Finder",
      action: `Finder created handover proposal: meeting at ${location} on ${meetingDate} (${timeSlot})`,
    });

    await handover.save();

    if (handover.claimId) {
      try {
        await Claim.findByIdAndUpdate(handover.claimId, {
          "handover.status": "ready",
          "handover.locationName": location,
          "handover.timeSlot": timeSlot,
          statusLabel: "Handover Proposed",
        });
      } catch {}
    }

    res.status(200).json({ success: true, message: "Handover proposal sent to receiver", data: handover });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Receiver suggests alternative meeting details (counter-proposal)
export const suggestAlternative = async (req, res) => {
  try {
    const { id } = req.params;
    const { meetingDate, timeSlot, location, safetyNote, suggestedBy } = req.body;

    const handover = await Handover.findById(id);
    if (!handover) {
      return res.status(404).json({ success: false, message: "Handover record not found" });
    }

    const locLower = (location || "").toLowerCase();
    const timeLower = (timeSlot || "").toLowerCase();
    const flags = [];
    if (locLower.includes("alley") || locLower.includes("depot") || locLower.includes("private") || locLower.includes("home")) {
      flags.push("Non-public or isolated venue detected");
    }
    if (timeLower.includes("11:") || timeLower.includes("12:") || timeLower.includes("01:") || timeLower.includes("night") || timeLower.includes("midnight")) {
      flags.push("Late night exchange scheduled");
    }
    if (flags.length > 0) {
      handover.suspiciousFlags = Array.from(new Set([...(handover.suspiciousFlags || []), ...flags]));
    }

    handover.counterProposal = {
      meetingDate: meetingDate || handover.meetingDate,
      timeSlot: timeSlot || handover.timeSlot,
      location: location || handover.location,
      safetyNote: safetyNote || "Alternative schedule proposed by receiver.",
      suggestedBy: suggestedBy || "owner",
      suggestedAt: new Date(),
      status: "pending",
    };
    handover.status = "counter_proposed";
    handover.history.push({
      at: new Date(),
      by: "Receiver",
      action: `Receiver proposed alternative: meeting at ${location} on ${meetingDate} (${timeSlot})`,
    });

    await handover.save();

    res.status(200).json({ success: true, message: "Counter-proposal sent to finder", data: handover });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Finder accepts receiver's counter-proposal: updates schedule and confirms
export const acceptCounterProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const handover = await Handover.findById(id);
    if (!handover) {
      return res.status(404).json({ success: false, message: "Handover record not found" });
    }

    if (!handover.counterProposal || handover.counterProposal.status !== "pending") {
      return res.status(400).json({ success: false, message: "No pending counter-proposal to accept" });
    }

    // Update meeting details to receiver's suggested details!
    handover.meetingDate = handover.counterProposal.meetingDate || handover.meetingDate;
    handover.timeSlot = handover.counterProposal.timeSlot || handover.timeSlot;
    handover.location = handover.counterProposal.location || handover.location;
    if (handover.counterProposal.safetyNote) {
      handover.safetyNote = handover.counterProposal.safetyNote;
    }
    handover.counterProposal.status = "accepted";
    handover.status = "confirmed";

    handover.history.push({
      at: new Date(),
      by: "Finder",
      action: `Finder accepted receiver's alternative schedule! Meeting confirmed at ${handover.location} on ${handover.meetingDate} (${handover.timeSlot})`,
    });

    await handover.save();

    if (handover.claimId) {
      try {
        await Claim.findByIdAndUpdate(handover.claimId, {
          "handover.locationName": handover.location,
          "handover.timeSlot": handover.timeSlot,
          statusLabel: "Handover Confirmed",
        });
      } catch {}
    }

    res.status(200).json({ success: true, message: "Alternative schedule accepted and confirmed", data: handover });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Finder declines counter-proposal: keeps original details
export const declineCounterProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const handover = await Handover.findById(id);
    if (!handover) {
      return res.status(404).json({ success: false, message: "Handover record not found" });
    }

    if (handover.counterProposal) {
      handover.counterProposal.status = "declined";
    }
    handover.status = "proposed";
    handover.history.push({
      at: new Date(),
      by: "Finder",
      action: "Finder declined the alternative schedule. Original meeting proposal maintained.",
    });

    await handover.save();

    res.status(200).json({ success: true, message: "Counter-proposal declined; original proposal maintained", data: handover });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Report risky meeting location to admin
export const reportRiskyLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, role, userId } = req.body;

    const handover = await Handover.findById(id);
    if (!handover) {
      return res.status(404).json({ success: false, message: "Handover record not found" });
    }

    const reportObj = {
      reportedBy: userId || "user",
      role: role || "member",
      reason: reason || "User flagged this meeting location as potentially unsafe or non-public.",
      reportedAt: new Date(),
    };

    handover.riskyLocationReports = handover.riskyLocationReports || [];
    handover.riskyLocationReports.push(reportObj);
    handover.hasWarning = true;
    handover.suspiciousFlags = Array.from(
      new Set([...(handover.suspiciousFlags || []), `Risk reported by ${role || "party"}: ${reason || "Unsafe venue"}`])
    );

    handover.history.push({
      at: new Date(),
      by: role === "finder" ? "Finder" : "Receiver",
      action: `Reported location safety concern to admin: "${reason || "Unsafe venue"}"`,
    });

    await handover.save();

    res.status(200).json({ success: true, message: "Safety concern reported to Trust & Safety team", data: handover });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new handover proposal
export const createHandover = async (req, res) => {
  try {
    const handoverData = { ...req.body };

    const locLower = (handoverData.location || "").toLowerCase();
    const timeLower = (handoverData.timeSlot || "").toLowerCase();
    const flags = [];
    if (locLower.includes("alley") || locLower.includes("depot") || locLower.includes("private") || locLower.includes("home")) {
      flags.push("Non-public or isolated venue detected");
    }
    if (timeLower.includes("11:") || timeLower.includes("12:") || timeLower.includes("01:") || timeLower.includes("night") || timeLower.includes("midnight")) {
      flags.push("Late night exchange scheduled");
    }
    handoverData.suspiciousFlags = flags;

    const handover = await Handover.create(handoverData);

    res.status(201).json({
      success: true,
      message: "Handover proposed successfully",
      data: handover,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Auto-approval: accept proposal
export const acceptProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const handover = await Handover.findById(id);
    if (!handover) {
      return res.status(404).json({ success: false, message: "Handover record not found" });
    }

    handover.status = "confirmed";
    handover.history.push({
      at: new Date(),
      by: role === "finder" ? "Finder" : "Owner / Recipient",
      action: "Auto-approved & confirmed handover schedule",
    });

    await handover.save();

    if (handover.claimId) {
      try {
        await Claim.findByIdAndUpdate(handover.claimId, {
          statusLabel: "Handover Confirmed",
        });
      } catch {}
    }

    res.status(200).json({ success: true, data: handover });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Two-party confirmation: Complete handover
export const confirmExchange = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, userId, email, isAdmin } = req.body; // 'owner' | 'finder' | 'both'

    const handover = await Handover.findById(id);
    if (!handover) {
      return res.status(404).json({ success: false, message: "Handover record not found" });
    }

    const normalizedRole = role === "receiver" ? "owner" : role;

    // Check identity if role is specified
    if (normalizedRole === "owner") {
      handover.confirmations.ownerConfirmed = true;
      handover.confirmations.ownerConfirmedAt = new Date();
      handover.history.push({
        at: new Date(),
        by: handover.owner.name || "Receiver",
        action: "Receiver confirmed physical receipt of the item.",
      });
    } else if (normalizedRole === "finder") {
      handover.confirmations.finderConfirmed = true;
      handover.confirmations.finderConfirmedAt = new Date();
      handover.history.push({
        at: new Date(),
        by: handover.finder.name || "Finder",
        action: "Finder confirmed physical handover of the item to receiver.",
      });
    } else if (normalizedRole === "both" && isAdmin) {
      // Only platform admin can simultaneously confirm both
      handover.confirmations.ownerConfirmed = true;
      handover.confirmations.ownerConfirmedAt = new Date();
      handover.confirmations.finderConfirmed = true;
      handover.confirmations.finderConfirmedAt = new Date();
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid confirmation role. Must be 'owner' or 'finder'.",
      });
    }

    // STRICT CHECK: Both parties must click before custody is confirmed
    const isFullyCompleted =
      Boolean(handover.confirmations.ownerConfirmed) && Boolean(handover.confirmations.finderConfirmed);

    if (isFullyCompleted) {
      handover.status = "completed";
      handover.ratingsUnlocked = true;
      handover.completedAt = new Date();
      handover.history.push({
        at: new Date(),
        by: "Both Parties Verified",
        action: "Mutual confirmation achieved! Safe handover completed. Rating unlocked for receiver.",
      });

      // Auto-resolve report if reportId is present
      if (handover.reportId) {
        try {
          await Item.findByIdAndUpdate(handover.reportId, { status: "resolved" });
        } catch {}
      }

      // Auto-reunite claim if claimId is present
      if (handover.claimId) {
        try {
          await Claim.findByIdAndUpdate(handover.claimId, {
            status: "reunited",
            statusLabel: "Reunited & Returned",
            statusDescription: "Ownership verified and physical custody confirmed by both parties.",
          });
        } catch {}
      }
    } else {
      // Still in progress: explicitly keep ratings locked
      handover.status = "confirmed";
      handover.ratingsUnlocked = false;
    }

    await handover.save();

    res.status(200).json({
      success: true,
      message: isFullyCompleted
        ? "Handover mutually confirmed! Ratings unlocked."
        : `Confirmed as ${normalizedRole === "owner" ? "Receiver" : "Finder"}. Awaiting other party confirmation.`,
      data: handover,
      isFullyCompleted,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Check if a user is eligible to review a finder (must have completed, unreviewed handover as owner)
export const getEligibleReviewHandover = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const { reviewerId, email } = req.query;

    if (!reviewerId && !email) {
      return res.status(200).json({ success: true, eligible: false, message: "Missing reviewer information" });
    }

    const query = {
      "finder.userId": targetUserId,
      status: "completed",
      "confirmations.ownerConfirmed": true,
      "confirmations.finderConfirmed": true,
      isReviewed: { $ne: true },
    };

    const userOr = [];
    if (reviewerId) userOr.push({ "owner.userId": reviewerId });
    if (email) userOr.push({ "owner.email": email.toLowerCase() });
    query.$or = userOr;

    const handover = await Handover.findOne(query).sort({ completedAt: -1 });

    if (!handover) {
      return res.status(200).json({
        success: true,
        eligible: false,
        data: { eligible: false, handover: null },
        message: "No unreviewed completed handovers found between this receiver and finder.",
      });
    }

    res.status(200).json({
      success: true,
      eligible: true,
      data: { eligible: true, handover },
      handover,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single handover by ID
export const getHandoverById = async (req, res) => {
  try {
    const { id } = req.params;
    const handover = await Handover.findById(id);
    if (!handover) {
      return res.status(404).json({ success: false, message: "Handover not found" });
    }
    res.status(200).json({ success: true, data: handover });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin warning dispatch
export const sendAdminWarning = async (req, res) => {
  try {
    const { id } = req.params;
    const { target, title, message, severity } = req.body;

    const handover = await Handover.findById(id);
    if (!handover) {
      return res.status(404).json({ success: false, message: "Handover record not found" });
    }

    const warning = {
      id: `wrn_${Date.now()}`,
      target: target || "finder",
      title: title || "Security Warning from Findora Trust Team",
      message: message || "Suspicious exchange detected.",
      severity: severity || "high",
      sentAt: new Date(),
    };

    handover.adminWarnings.unshift(warning);
    handover.history.push({
      at: new Date(),
      by: "Findora Trust Admin",
      action: `Issued safety warning to ${warning.target.toUpperCase()}: "${warning.title}"`,
    });

    await handover.save();

    res.status(200).json({ success: true, data: handover, warning });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete handover
export const deleteHandover = async (req, res) => {
  try {
    const { id } = req.params;
    const handover = await Handover.findByIdAndDelete(id);
    if (!handover) {
      return res.status(404).json({ success: false, message: "Handover not found" });
    }
    res.status(200).json({ success: true, message: "Handover deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
