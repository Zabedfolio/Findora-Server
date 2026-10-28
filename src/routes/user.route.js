import express from "express";
import {
  getUserPublicProfile,
  updateUserProfile,
  getAllUsers,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/", getAllUsers);
router.get("/:id", getUserPublicProfile);
router.patch("/:id", updateUserProfile);
router.put("/:id", updateUserProfile);
router.post("/update", updateUserProfile);

export default router;
