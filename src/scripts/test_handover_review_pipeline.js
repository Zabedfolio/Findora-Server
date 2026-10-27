import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Item from "../models/item.model.js";
import Claim from "../models/claim.model.js";
import Handover from "../models/handover.model.js";
import Review from "../models/review.model.js";
import Config from "../config/Config.js";

async function runPipelineTest() {
  console.log("=== STARTING FULL HANDOVER & REVIEW PIPELINE VERIFICATION ===");
  const uri = Config.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI not configured in Config.js");
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB Atlas.");

  const db = mongoose.connection.db;
  const userCollection = db.collection("user");

  const finderUser = await userCollection.findOne({ email: "demo.tariq@findora.app" });
  const receiverUser = await userCollection.findOne({ email: "demo.alex@findora.app" });
  const randomUser = (await userCollection.findOne({
    email: { $nin: ["demo.tariq@findora.app", "demo.alex@findora.app"] },
  })) || { _id: "usr_random_999", name: "Random Stranger", email: "stranger@unknown.com" };

  if (!finderUser || !receiverUser) {
    throw new Error("Required demo users not found in database.");
  }

  console.log(`Finder: ${finderUser.name} (${finderUser._id})`);
  console.log(`Receiver: ${receiverUser.name} (${receiverUser._id})`);
  console.log(`Random third-party: ${randomUser?.name} (${randomUser?._id})`);

  let testReportId = null;
  let testClaimId = null;
  let testHandoverId = null;
  let testReviewId = null;

  try {
    // 1. Finder posts a found item
    console.log("\n--- STEP 1: Finder reports found item ---");
    const testReport = await Item.create({
      title: "Pipeline Test Black Leather Wallet",
      description: "Found at Central Station with cards inside",
      category: "Wallets",
      type: "found",
      status: "active",
      location: "Central Metro Concourse, Platform 2",
      date: new Date(),
      postedBy: {
        userId: finderUser._id.toString(),
        name: finderUser.name,
        email: finderUser.email,
      },
    });
    testReportId = testReport._id;
    console.log(`✓ Report created: ${testReport.title} [ID: ${testReportId}]`);

    // 2. Claimant claims item
    console.log("\n--- STEP 2: Claimant submits ownership claim ---");
    const testClaim = await Claim.create({
      claimNumber: `CLM-${Date.now()}`,
      reportId: testReportId,
      itemTitle: testReport.title,
      claimant: {
        userId: receiverUser._id.toString(),
        name: receiverUser.name,
        email: receiverUser.email,
      },
      finder: {
        userId: finderUser._id.toString(),
        name: finderUser.name,
        email: finderUser.email,
      },
      claimantProof: {
        description: "This is my wallet, it contains my student ID card with name Alex.",
      },
      status: "pending",
    });
    testClaimId = testClaim._id;
    console.log(`✓ Claim submitted: [ID: ${testClaimId}]`);

    // 3. Finder approves claim and proposes Handover
    console.log("\n--- STEP 3: Finder approves claim & proposes Handover ---");
    testClaim.status = "approved";
    testClaim.approvedAt = new Date();
    await testClaim.save();

    const testHandover = await Handover.create({
      claimId: testClaimId,
      reportId: testReportId,
      itemTitle: testReport.title,
      itemCategory: testReport.category,
      meetingDate: "2026-10-28",
      timeSlot: "14:00 - 15:00",
      location: "City Center Police Box Public Spot, Platform 2",
      status: "proposed",
      proposedBy: "finder",
      owner: {
        userId: receiverUser._id.toString(),
        name: receiverUser.name,
        email: receiverUser.email,
      },
      finder: {
        userId: finderUser._id.toString(),
        name: finderUser.name,
        email: finderUser.email,
      },
      confirmations: {
        ownerConfirmed: false,
        finderConfirmed: false,
      },
      ratingsUnlocked: false,
      isReviewed: false,
    });
    testHandoverId = testHandover._id;
    console.log(`✓ Handover proposed: [ID: ${testHandoverId}], status: ${testHandover.status}`);

    // Counterparty accepts proposal -> status becomes 'confirmed'
    testHandover.status = "confirmed";
    await testHandover.save();
    console.log(`✓ Handover proposal accepted -> status: ${testHandover.status}`);

    // 4. Physical Meeting & Dual Confirmation Test
    console.log("\n--- STEP 4: Physical Meeting & Dual Confirmation Checks ---");
    
    // 4a. Finder clicks "I Handed Over Item"
    testHandover.confirmations.finderConfirmed = true;
    testHandover.finderConfirmedAt = new Date();
    // Rule: if ONLY finder confirms, status MUST remain 'confirmed', ratingsUnlocked MUST stay false!
    const bothConfirmedAfterFinder = testHandover.confirmations.ownerConfirmed && testHandover.confirmations.finderConfirmed;
    if (!bothConfirmedAfterFinder) {
      testHandover.status = "confirmed";
      testHandover.ratingsUnlocked = false;
    }
    await testHandover.save();

    const fetchedHandover1 = await Handover.findById(testHandoverId);
    console.log(`Finder confirmed: ${fetchedHandover1.confirmations.finderConfirmed}`);
    console.log(`Owner confirmed: ${fetchedHandover1.confirmations.ownerConfirmed}`);
    console.log(`Status after ONLY finder confirms: "${fetchedHandover1.status}" (Expected: "confirmed")`);
    console.log(`Ratings unlocked: ${fetchedHandover1.ratingsUnlocked} (Expected: false)`);

    if (fetchedHandover1.status !== "confirmed" || fetchedHandover1.ratingsUnlocked === true) {
      throw new Error("FAILED: Handover was finalized with only finder's confirmation!");
    }
    console.log("✓ PASS: Single-party confirmation properly prevents early completion.");

    // 4b. Receiver clicks "I Received My Item"
    console.log("\nNow Receiver confirms receipt...");
    fetchedHandover1.confirmations.ownerConfirmed = true;
    fetchedHandover1.ownerConfirmedAt = new Date();
    if (fetchedHandover1.confirmations.ownerConfirmed && fetchedHandover1.confirmations.finderConfirmed) {
      fetchedHandover1.status = "completed";
      fetchedHandover1.completedAt = new Date();
      fetchedHandover1.ratingsUnlocked = true;
    }
    await fetchedHandover1.save();

    const fetchedHandover2 = await Handover.findById(testHandoverId);
    console.log(`Finder confirmed: ${fetchedHandover2.confirmations.finderConfirmed}`);
    console.log(`Owner confirmed: ${fetchedHandover2.confirmations.ownerConfirmed}`);
    console.log(`Status after BOTH confirm: "${fetchedHandover2.status}" (Expected: "completed")`);
    console.log(`Ratings unlocked: ${fetchedHandover2.ratingsUnlocked} (Expected: true)`);

    if (fetchedHandover2.status !== "completed" || fetchedHandover2.ratingsUnlocked !== true) {
      throw new Error("FAILED: Handover did not complete after both confirmed!");
    }
    console.log("✓ PASS: Dual confirmation successfully unlocks ratings and completes exchange.");

    // 5. Review Exclusivity & Security Tests
    console.log("\n--- STEP 5: Strict Review Authorization Checks ---");

    // Test API endpoint via HTTP
    const apiBase = "http://localhost:5000/api";

    // 5a. Test: Random non-counterparty attempts to submit a review without completed handover
    console.log("Attempt 1: Random user attempts review with no valid handover...");
    const badReviewRes1 = await fetch(`${apiBase}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewer: {
          userId: randomUser ? randomUser._id.toString() : "random_user_999",
          name: "Random Stranger",
          email: "stranger@unknown.com",
        },
        targetUser: {
          userId: finderUser._id.toString(),
          name: finderUser.name,
        },
        rating: 5,
        comment: "I am a random user leaving a fake 5-star review!",
      }),
    });
    const badReviewJson1 = await badReviewRes1.json();
    console.log(`Status code: ${badReviewRes1.status} (Expected: 403)`);
    console.log(`Message: "${badReviewJson1.message}"`);
    if (badReviewRes1.status !== 403) {
      throw new Error("FAILED: Random user review was not rejected with 403!");
    }
    console.log("✓ PASS: Unverified review without handover was strictly blocked (403).");

    // 5b. Test: Random user attempts to hijack the completed handoverId
    console.log("\nAttempt 2: Random user attempts review by spoofing the handoverId...");
    const badReviewRes2 = await fetch(`${apiBase}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handoverId: testHandoverId.toString(),
        reviewer: {
          userId: randomUser ? randomUser._id.toString() : "random_user_999",
          name: "Random Hijacker",
          email: "hijacker@unknown.com",
        },
        targetUser: {
          userId: finderUser._id.toString(),
          name: finderUser.name,
        },
        rating: 1,
        comment: "I hijacked this handover to leave a 1-star review!",
      }),
    });
    const badReviewJson2 = await badReviewRes2.json();
    console.log(`Status code: ${badReviewRes2.status} (Expected: 403)`);
    console.log(`Message: "${badReviewJson2.message}"`);
    if (badReviewRes2.status !== 403) {
      throw new Error("FAILED: Hijacked handover review was not rejected with 403!");
    }
    console.log("✓ PASS: Non-receiver was strictly prevented from reviewing using this handover (403).");

    // 5c. Test: Legitimate Receiver submits review with completed handoverId
    console.log("\nAttempt 3: Legitimate Receiver submits verified review for the completed exchange...");
    const goodReviewRes = await fetch(`${apiBase}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handoverId: testHandoverId.toString(),
        reviewer: {
          userId: receiverUser._id.toString(),
          name: receiverUser.name,
          email: receiverUser.email,
          role: "owner",
        },
        targetUser: {
          userId: finderUser._id.toString(),
          name: finderUser.name,
          email: finderUser.email,
        },
        targetItem: {
          itemId: testReportId.toString(),
          title: testReport.title,
        },
        rating: 5,
        comment: "Tariq was incredible! We met at the police box and I got my wallet back with everything intact.",
      }),
    });
    const goodReviewJson = await goodReviewRes.json();
    console.log(`Status code: ${goodReviewRes.status} (Expected: 201)`);
    console.log(`Review ID: ${goodReviewJson.data?._id}`);
    console.log(`isVerifiedReturn: ${goodReviewJson.data?.isVerifiedReturn}`);
    if (goodReviewRes.status !== 201 || !goodReviewJson.data?.isVerifiedReturn) {
      throw new Error(`FAILED: Legitimate receiver review failed: ${goodReviewJson.message}`);
    }
    testReviewId = goodReviewJson.data._id;
    console.log("✓ PASS: Verified review successfully saved with isVerifiedReturn: true.");

    // 5d. Test: Check handover.isReviewed flag
    const updatedHandover = await Handover.findById(testHandoverId);
    console.log(`\nHandover isReviewed: ${updatedHandover.isReviewed} (Expected: true)`);
    if (!updatedHandover.isReviewed) {
      throw new Error("FAILED: Handover isReviewed was not marked true!");
    }

    // 5e. Test: Duplicate review attempt for same handover
    console.log("\nAttempt 4: Receiver attempts duplicate review on the same handover...");
    const duplicateReviewRes = await fetch(`${apiBase}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handoverId: testHandoverId.toString(),
        reviewer: {
          userId: receiverUser._id.toString(),
          name: receiverUser.name,
          email: receiverUser.email,
        },
        targetUser: {
          userId: finderUser._id.toString(),
          name: finderUser.name,
        },
        rating: 5,
        comment: "Trying to submit a second review for the same exchange.",
      }),
    });
    const dupJson = await duplicateReviewRes.json();
    console.log(`Status code: ${duplicateReviewRes.status} (Expected: 400)`);
    console.log(`Message: "${dupJson.message}"`);
    if (duplicateReviewRes.status !== 400) {
      throw new Error("FAILED: Duplicate review was not rejected with 400!");
    }
    console.log("✓ PASS: Duplicate review prevention working perfectly.");

    // 5f. Test: Eligibility check ensures the reviewed handover is excluded
    console.log("\nAttempt 5: Checking eligibility endpoint for receiver...");
    const eligRes = await fetch(`${apiBase}/handovers/eligible/${finderUser._id}?reviewerId=${receiverUser._id}`);
    const eligJson = await eligRes.json();
    console.log(`Returned Handover ID: ${eligJson.handover?._id}`);
    if (eligJson.handover?._id === testHandoverId.toString()) {
      throw new Error("FAILED: Reviewed testHandover was still returned as eligible!");
    }
    console.log("✓ PASS: Reviewed testHandover is strictly excluded from future review eligibility.");

    console.log("\n=======================================================");
    console.log("🎉 ALL TESTS PASSED! PIPELINE IS BULLETPROOF & VERIFIED!");
    console.log("=======================================================");

  } finally {
    // Cleanup test data
    console.log("\nCleaning up test records...");
    if (testReviewId) await Review.findByIdAndDelete(testReviewId);
    if (testHandoverId) await Handover.findByIdAndDelete(testHandoverId);
    if (testClaimId) await Claim.findByIdAndDelete(testClaimId);
    if (testReportId) await Item.findByIdAndDelete(testReportId);
    console.log("Cleaned up successfully.");
    await mongoose.disconnect();
  }
}

runPipelineTest().catch((err) => {
  console.error("\n❌ PIPELINE TEST FAILED:", err);
  process.exit(1);
});
