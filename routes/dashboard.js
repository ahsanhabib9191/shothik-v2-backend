const express = require("express");
const router = express.Router();
const AsyncHandler = require("express-async-handler");
const {
  AllUserAcquisitionController,
  PaidUserAcquisitionController,
  ApiHitDistributionController,
  ServiceUsageComparisonController,
  AdminActivityList,
  errorLogsController,
  changeAppMode,
  getModeController,
} = require("../controllers/dashboardController");
const { authAdmin } = require('@ridz-shothikai/shothik-auth-service/src/middleware');

// all user acquisition
router.get(
  "/all-user-acquisition",
  authAdmin,
  AsyncHandler(AllUserAcquisitionController)
);

// paid user acquisition
router.get(
  "/paid-user-acquisition",
  authAdmin,
  AsyncHandler(PaidUserAcquisitionController)
);

// api hit distribution
router.get(
  "/api-hit-distribution",
  authAdmin,
  AsyncHandler(ApiHitDistributionController)
);

// service usage comparison
router.get(
  "/service-usage-comparison",
  authAdmin,
  AsyncHandler(ServiceUsageComparisonController)
);

// service usage comparison
router.get("/admin-activities", authAdmin, AsyncHandler(AdminActivityList));

// get all error logs
router.get("/error-logs", authAdmin, AsyncHandler(errorLogsController));

router.put("/change-app-mode", authAdmin, AsyncHandler(changeAppMode));
router.get("/get-app-mode", AsyncHandler(getModeController));

// export router
module.exports = router;
