const express = require('express');
const { createFolder, getFolders, addMeetingToFolder, getMeetingsInFolder, deleteFolder, moveMeetingToAnotherFolder, addMeetingsToFolder, moveMeetingsToAnotherFolder } = require('../controllers/folderController');
const { auth } = require('@ridz-shothikai/shothik-auth-service/src/middleware');
const router = express.Router();

// Folder routes
router.post('/create', auth, createFolder);
router.put('/update/:id', auth, createFolder);
router.delete('/delete/:id', auth, deleteFolder);
router.get('/all', auth, getFolders);

// Meeting to folder
router.post('/add-meeting', auth, addMeetingToFolder);
router.post('/add-meetings', auth, addMeetingsToFolder);
router.put('/move-meeting', auth, moveMeetingToAnotherFolder);
router.put('/move-meetings', auth, moveMeetingsToAnotherFolder);
router.get('/meetings/:id', auth, getMeetingsInFolder);

module.exports = router;
