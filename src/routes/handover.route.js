import express from "express";
import {
  getHandovers,
  createHandover,
  acceptProposal,
  confirmExchange,
  sendAdminWarning,
  getHandoverById,
  getEligibleReviewHandover,
} from "../controllers/handover.controller.js";

const router = express.Router();

router.get("/", getHandovers);
router.get("/eligible/:targetUserId", getEligibleReviewHandover);
router.get("/:id", getHandoverById);
router.post("/", createHandover);
router.post("/:id/accept", acceptProposal);
router.post("/:id/confirm", confirmExchange);
router.post("/:id/warn", sendAdminWarning);

export default router;
