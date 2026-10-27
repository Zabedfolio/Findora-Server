import express from "express";
import {
  getUserDashboardStats,
  getAdminDashboardMetrics,
} from "../controllers/dashboard.controller.js";

const router = express.Router();

// User-specific dashboard analytics
router.get("/user-stats", getUserDashboardStats);

// Admin platform-wide telemetry
router.get("/admin-metrics", getAdminDashboardMetrics);

export default router;
