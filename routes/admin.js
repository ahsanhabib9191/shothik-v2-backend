const express = require("express");
const asyncHandler = require("express-async-handler");
const {
  register,
  login,
  createPremiumUser,
  upgradeUserInformation,
  getAllAdmins,
  activeAndInactiveAdmin,
  changeUserRole,
  addAdmin,
} = require("../controllers/adminController");
// const { authAdmin } = require("../middleware/auth");

const { authAdmin } = require('@ridz-shothikai/shothik-auth-service/src/middleware');
const router = express.Router();

// Define your routes here
router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));

router.post("/create-premium-user", authAdmin, asyncHandler(createPremiumUser));

//
router.post(
  "/upgrade-package",
  authAdmin,
  asyncHandler(upgradeUserInformation)
);

router.get("/list", authAdmin, asyncHandler(getAllAdmins));
router.patch(
  "/update-status/:id",
  authAdmin,
  asyncHandler(activeAndInactiveAdmin)
);
router.patch("/change-role/:id", authAdmin, asyncHandler(changeUserRole));
router.post("/add-admin", authAdmin, asyncHandler(addAdmin));

// Export the router
module.exports = router;
