import Handover from "../models/handover.model.js";
import Item from "../models/item.model.js";

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

    const upcoming = all.filter((h) => h.status === "proposed" || h.status === "confirmed");
    const past = all.filter((h) => h.status === "completed" || h.status === "reunited");
    const suspicious = all.filter((h) => (h.suspiciousFlags && h.suspiciousFlags.length > 0) || (h.adminWarnings && h.adminWarnings.length > 0));

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
        proposed: all.filter((h) => h.status === "proposed").length,
        confirmed: all.filter((h) => h.status === "confirmed").length,
        completed: past.length,
        suspicious: suspicious.length,
      },
    });
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

    res.status(200).json({ success: true, data: handover });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Two-party confirmation: Complete handover
export const confirmExchange = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body; // 'owner' | 'finder' | 'both'

    const handover = await Handover.findById(id);
    if (!handover) {
      return res.status(404).json({ success: false, message: "Handover record not found" });
    }

    if (role === "owner" || role === "both") {
      handover.confirmations.ownerConfirmed = true;
      handover.confirmations.ownerConfirmedAt = new Date();
    }
    if (role === "finder" || role === "both") {
      handover.confirmations.finderConfirmed = true;
      handover.confirmations.finderConfirmedAt = new Date();
    }

    const isFullyCompleted = handover.confirmations.ownerConfirmed && handover.confirmations.finderConfirmed;
    if (isFullyCompleted) {
      handover.status = "completed";
      handover.ratingsUnlocked = true;
      handover.completedAt = new Date();
      handover.history.push({
        at: new Date(),
        by: "Both Parties",
        action: "Both parties verified exchange! Handover completed.",
      });

      // Auto-resolve report if reportId is present
      if (handover.reportId) {
        await Item.findByIdAndUpdate(handover.reportId, { status: "resolved" });
      }
    } else {
      handover.history.push({
        at: new Date(),
        by: role === "finder" ? "Finder" : "Owner",
        action: `Signed delivery confirmation (${role}). Awaiting counterparty.`,
      });
    }

    await handover.save();

    res.status(200).json({
      success: true,
      data: handover,
      isFullyCompleted,
    });
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
