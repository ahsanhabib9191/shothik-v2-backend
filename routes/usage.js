const express = require('express');
const asyncHandler = require('express-async-handler');
const { authOptional }  = require('@ridz-shothikai/shothik-auth-service/src/middleware');
const { saveUsageHandler, getAllUsageHistory, getUserUsageHistory, getUserUsageHistoryByDay } = require('../controllers/usageController');

const router = express.Router();

// Define your routes here
router.get('/', authOptional, asyncHandler(saveUsageHandler));

router.get('/all', asyncHandler(getAllUsageHistory));
router.get('/user/:id', asyncHandler(getUserUsageHistory));
router.get('/user/day/:id', asyncHandler(getUserUsageHistoryByDay));

// Export the router
module.exports = router;
