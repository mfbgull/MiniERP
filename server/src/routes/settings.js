const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate } = require('../middleware/auth');

// All settings routes require authentication
router.use(authenticate);

// Get all settings
router.get('/', settingsController.getSettings);

// Get specific setting
router.get('/:key', settingsController.getSetting);

// Update specific setting
router.put('/:key', settingsController.updateSetting);

// Update multiple settings
router.post('/bulk', settingsController.updateSettings);

module.exports = router;
