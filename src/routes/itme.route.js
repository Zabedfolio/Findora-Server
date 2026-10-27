import express from "express";
import {
  createItem,
  getAllItems,
  getItemById,
  updateItem,
  deleteItem,
  markAsResolved,
} from "../controllers/item.controller.js";

const router = express.Router();

router.post("/", createItem);                 // Create new item
router.get("/", getAllItems);                 // Get all items (with filters)
router.get("/:id", getItemById);              // Get single item
router.put("/:id", updateItem);               // Update item
router.delete("/:id", deleteItem);            // Delete item
router.patch("/:id/resolve", markAsResolved); // Mark as resolved

export default router;