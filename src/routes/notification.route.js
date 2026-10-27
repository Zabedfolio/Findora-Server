import express from "express";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification,
} from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/", getNotifications);
router.post("/", createNotification);
router.patch("/:id/read", markNotificationRead);
router.post("/mark-all-read", markAllNotificationsRead);

export default router;
