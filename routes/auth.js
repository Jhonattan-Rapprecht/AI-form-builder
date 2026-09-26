const express = require('express');
const authController = require('../controllers/authController');
const { loginRateLimit } = require('../middleware/loginRateLimit');
const requireSameOrigin = require('../middleware/requireSameOrigin');

const router = express.Router();

router.get('/login', authController.getLogin);
router.post('/login', requireSameOrigin, loginRateLimit, authController.postLogin);
router.post('/logout', requireSameOrigin, authController.postLogout);

module.exports = router;