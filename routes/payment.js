const express = require("express");
const router = express.Router();
const AsyncHandler = require("express-async-handler");

const {
  bkashCheckout,
  bkashCallback,
  refund,
  refundStatus,
  stripeCheckout,
  razonpayCheckout,
  razorpayCallback,
  stripeCallback,
} = require("../controllers/paymentController.js");
const authCheck = require("../middleware/bkashAuthorization.js");

const { auth } = require("@ridz-shothikai/shothik-auth-service/src/middleware");

const { tranSectionHistory } = require("../controllers/transection.js");

router.use(authCheck);

// =========== Bkash Payment ==============
router.post("/bkash/create", auth, AsyncHandler(bkashCheckout));
router.get("/bkash/callback", AsyncHandler(bkashCallback));

router.post("/refund", refund);
router.post("/refund-status", refundStatus);

// =========== Stripe Payment ==============
router.post("/stripe/create", auth, AsyncHandler(stripeCheckout));
router.post("/stripe/webhook", AsyncHandler(stripeCallback));

// =========== Raxor Payment ==============
router.post("/razor/create", auth, AsyncHandler(razonpayCheckout));
router.post("/razor/webhook", AsyncHandler(razorpayCallback));

// =========== Transection History ==============
router.get("/transection-history", auth, AsyncHandler(tranSectionHistory));

// export router
module.exports = router;
