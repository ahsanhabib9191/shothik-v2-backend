const express = require('express');
const asyncHandler = require('express-async-handler');
const { createReport, getReports, deleteReport } = require('../controllers/reportController');
const { auth } = require('@ridz-shothikai/shothik-auth-service/src/middleware');
const router = express.Router();

// Define your routes here
router.post('/send-report', auth, asyncHandler(createReport));
router.get('/all-report', auth, asyncHandler(getReports));
router.delete('/delete-report/:id', auth, asyncHandler(deleteReport));


// Export the router
module.exports = router;
