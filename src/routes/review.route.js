import express from "express";
import {
  getReviews,
  createReview,
  moderateReview,
  reportReview,
} from "../controllers/review.controller.js";

const router = express.Router();

router.get("/", getReviews);
router.post("/", createReview);
router.patch("/:id/status", moderateReview);
router.post("/:id/report", reportReview);

export default router;
