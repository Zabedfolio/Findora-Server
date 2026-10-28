import FraudCase from "../models/fraud.model.js";
import mongoose from "mongoose";

// Get fraud cases for Admin Trust & Safety Console
export const getFraudCases = async (req, res) => {
  try {
    const { status, riskLevel, q, limit = 20, page = 1 } = req.query;

    const filter = {};
    if (status && status !== "all") {
      filter.status = status;
    }
    if (riskLevel && riskLevel !== "all") {
      filter.riskLevel = riskLevel;
    }

    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), "i");
      filter.$or = [
        { caseId: regex },
        { "targetUser.name": regex },
        { "targetUser.email": regex },
        { triggerReason: regex },
        { evidence: regex },
      ];
    }

    const numLimit = Math.min(Number(limit) || 20, 100);
    const numPage = Math.max(Number(page) || 1, 1);
    const skip = (numPage - 1) * numLimit;

    const [cases, totalCount, statusCounts, riskCounts] = await Promise.all([
      FraudCase.find(filter).sort({ createdAt: -1 }).skip(skip).limit(numLimit),
      FraudCase.countDocuments(filter),
      FraudCase.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      FraudCase.aggregate([
        {
          $group: {
            _id: "$riskLevel",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const counts = {
      all: 0,
      investigating: 0,
      actioned: 0,
      dismissed: 0,
      highRisk: 0,
      criticalRisk: 0,
    };

    statusCounts.forEach((s) => {
      if (counts[s._id] !== undefined) {
        counts[s._id] = s.count;
      }
      counts.all += s.count;
    });

    riskCounts.forEach((r) => {
      if (r._id === "high") counts.highRisk = r.count;
      if (r._id === "critical") counts.criticalRisk = r.count;
    });

    res.status(200).json({
      success: true,
      data: cases,
      totalCount,
      totalPages: Math.ceil(totalCount / numLimit),
      currentPage: numPage,
      counts,
    });
  } catch (error) {
    console.error("Get fraud cases error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new fraud case or abuse report
export const createFraudCase = async (req, res) => {
  try {
    const {
      targetUser,
      reportedBy,
      targetType,
      targetId,
      triggerReason,
      riskScore,
      riskLevel,
      evidence,
      deviceFingerprint,
      ipAddress,
    } = req.body;

    if (!targetUser || !targetUser.userId) {
      return res.status(400).json({ success: false, message: "Target user is required" });
    }
    if (!triggerReason) {
      return res.status(400).json({ success: false, message: "Trigger reason is required" });
    }

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const caseId = `FRD-${randomSuffix}`;

    const newCase = await FraudCase.create({
      caseId,
      targetUser,
      reportedBy: reportedBy || { name: "Community User" },
      targetType: targetType || "claim",
      targetId: targetId || "",
      triggerReason,
      riskScore: riskScore || 65,
      riskLevel: riskLevel || "high",
      evidence: evidence || "",
      deviceFingerprint: deviceFingerprint || "",
      ipAddress: ipAddress || req.ip || "",
      status: "investigating",
    });

    res.status(201).json({
      success: true,
      message: "Fraud case / abuse report logged successfully",
      data: newCase,
    });
  } catch (error) {
    console.error("Create fraud case error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Update fraud case status (e.g. resolve, dismiss, take punitive action)
export const updateFraudCaseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actionNotes, flagTargetUser } = req.body;

    const allowedStatuses = [
      "investigating",
      "actioned",
      "dismissed",
      "warning_issued",
      "suspended",
      "banned",
      "cleared",
    ];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status value. Allowed: ${allowedStatuses.join(", ")}` });
    }

    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { caseId: id };
    const fraudCase = await FraudCase.findOne(query);
    if (!fraudCase) {
      return res.status(404).json({ success: false, message: "Fraud case not found" });
    }

    fraudCase.status = status;
    if (actionNotes) {
      fraudCase.actionNotes = actionNotes;
    }

    await fraudCase.save();

    // If admin requested to flag target user
    if (flagTargetUser && fraudCase.targetUser?.userId) {
      try {
        const db = mongoose.connection.db;
        if (db) {
          const userCol = db.collection("user");
          await userCol.updateOne(
            { _id: fraudCase.targetUser.userId },
            { $set: { flagged: true, updatedAt: new Date() } }
          );
        }
      } catch (e) {
        console.warn("Could not update user flagged status in DB:", e.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `Fraud case status updated to ${status}`,
      data: fraudCase,
    });
  } catch (error) {
    console.error("Update fraud case error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
