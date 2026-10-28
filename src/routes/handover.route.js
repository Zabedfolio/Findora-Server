import express from "express";
import {
  getHandovers,
  createHandover,
  proposeHandover,
  acceptProposal,
  suggestAlternative,
  acceptCounterProposal,
  declineCounterProposal,
  reportRiskyLocation,
  confirmExchange,
  sendAdminWarning,
  getHandoverById,
  getEligibleReviewHandover,
  deleteHandover,
} from "../controllers/handover.controller.js";

const router = express.Router();

router.get("/", getHandovers);
router.get("/eligible/:targetUserId", getEligibleReviewHandover);
router.get("/:id", getHandoverById);
router.delete("/:id", deleteHandover);
router.post("/", createHandover);
router.post("/:id/propose", proposeHandover);
router.post("/:id/accept", acceptProposal);
router.post("/:id/suggest", suggestAlternative);
router.post("/:id/counter/accept", acceptCounterProposal);
router.post("/:id/counter/decline", declineCounterProposal);
router.post("/:id/report-risky", reportRiskyLocation);
router.post("/:id/confirm", confirmExchange);
router.post("/:id/warn", sendAdminWarning);

export default router;
