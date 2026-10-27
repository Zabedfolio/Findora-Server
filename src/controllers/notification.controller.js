import Notification from "../models/notification.model.js";

// Get notifications for authenticated user
export const getNotifications = async (req, res) => {
  try {
    const { recipientId, email, unreadOnly } = req.query;

    if (!recipientId && !email) {
      return res.status(200).json({
        success: true,
        data: [],
        unreadCount: 0,
      });
    }

    const filter = {};
    if (recipientId && email) {
      filter.$or = [{ recipientId }, { recipientEmail: email.toLowerCase() }];
    } else if (recipientId) {
      filter.recipientId = recipientId;
    } else if (email) {
      filter.recipientEmail = email.toLowerCase();
    }

    if (unreadOnly === "true" || unreadOnly === true) {
      filter.read = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(30),
      Notification.countDocuments({ ...filter, read: false }),
    ]);

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark single notification as read
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark all user notifications as read
export const markAllNotificationsRead = async (req, res) => {
  try {
    const { recipientId, email } = req.body;

    if (!recipientId && !email) {
      return res.status(400).json({ success: false, message: "User identifier is required" });
    }

    const filter = {};
    if (recipientId && email) {
      filter.$or = [{ recipientId }, { recipientEmail: email.toLowerCase() }];
    } else if (recipientId) {
      filter.recipientId = recipientId;
    } else if (email) {
      filter.recipientEmail = email.toLowerCase();
    }

    const result = await Notification.updateMany(filter, { $set: { read: true } });

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark all read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper / Endpoint to create notification
export const createNotification = async (req, res) => {
  try {
    const { recipientId, recipientEmail, sender, type, title, message, link } = req.body;

    if (!recipientId && !recipientEmail) {
      return res.status(400).json({ success: false, message: "Recipient is required" });
    }
    if (!title || !message) {
      return res.status(400).json({ success: false, message: "Title and message are required" });
    }

    const notification = await Notification.create({
      recipientId: recipientId || recipientEmail,
      recipientEmail: recipientEmail || "",
      sender: sender || { name: "Findora System" },
      type: type || "system",
      title,
      message,
      link: link || "",
      read: false,
    });

    res.status(201).json({
      success: true,
      message: "Notification sent",
      data: notification,
    });
  } catch (error) {
    console.error("Create notification error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};
