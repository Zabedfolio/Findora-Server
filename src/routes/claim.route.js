import express from "express";
import {
  createClaim,
  getMyClaims,
  approveClaim,
  rejectClaim,
} from "../controllers/claim.controller.js";

const router = express.Router();

router.post("/", createClaim);
router.get("/mine", getMyClaims);
router.post("/:id/approve", approveClaim);
router.post("/:id/reject", rejectClaim);

export default router;
