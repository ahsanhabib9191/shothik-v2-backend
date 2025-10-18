const express = require("express");
const asyncHandler = require("express-async-handler");
const { authAdmin } = require("@ridz-shothikai/shothik-auth-service/src/middleware");
const {
  getAllTransactions,
  getUserTransactions,
  updateTransactionStatus,
  getValidateTransaction,
} = require("../controllers/transactionController");
// const multer = require('multer');

const router = express.Router();

router.get("/all", asyncHandler(getAllTransactions));
router.get("/user/:id", asyncHandler(getUserTransactions));
router.put(
  "/update/status/:id",
  authAdmin,
  asyncHandler(updateTransactionStatus)
);
router.get(
  "/check-package-expiry/:userId/:packageName",
  asyncHandler(getValidateTransaction)
);

// Export the router
module.exports = router;
