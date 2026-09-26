const express = require('express');
const adminController = require('../controllers/adminController');
const requireAuth = require('../middleware/requireAuth');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');

const router = express.Router();

router.get('/', requireAuth, requireSuperAdmin, adminController.getAdminTestPage);

module.exports = router;