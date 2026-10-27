import express from "express";
import {
  createClaim,
  getMyClaims,
  getClaimById,
  updateClaim,
  deleteClaim,
  approveClaim,
  rejectClaim,
  submitAdditionalProof,
  markClaimReunited,
} from "../controllers/claim.controller.js";

const router = express.Router();

router.post("/", createClaim);
router.get("/mine", getMyClaims);
router.get("/:id", getClaimById);
router.patch("/:id", updateClaim);
router.delete("/:id", deleteClaim);
router.post("/:id/cancel", deleteClaim);
router.post("/:id/approve", approveClaim);
router.post("/:id/reject", rejectClaim);
router.post("/:id/provide-proof", submitAdditionalProof);
router.post("/:id/reunited", markClaimReunited);

export default router;
