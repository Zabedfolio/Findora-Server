import express from "express";
import { getUserPublicProfile } from "../controllers/user.controller.js";

const router = express.Router();

router.get("/:id", getUserPublicProfile);

export default router;
