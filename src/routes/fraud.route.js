import express from "express";
import {
  getFraudCases,
  createFraudCase,
  updateFraudCaseStatus,
} from "../controllers/fraud.controller.js";

const router = express.Router();

router.get("/", getFraudCases);
router.post("/", createFraudCase);
router.patch("/:id/status", updateFraudCaseStatus);

export default router;
