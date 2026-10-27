import express from "express";
import {
  getHandovers,
  createHandover,
  acceptProposal,
  confirmExchange,
  sendAdminWarning,
} from "../controllers/handover.controller.js";

const router = express.Router();

router.get("/", getHandovers);
router.post("/", createHandover);
router.post("/:id/accept", acceptProposal);
router.post("/:id/confirm", confirmExchange);
router.post("/:id/warn", sendAdminWarning);

export default router;
