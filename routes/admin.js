const express = require('express');
const adminController = require('../controllers/adminController');
const requireAuth = require('../middleware/requireAuth');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const requireSameOrigin = require('../middleware/requireSameOrigin');

const router = express.Router();

router.use(requireAuth, requireSuperAdmin, (req, res, next) => {
	res.locals.currentUser = req.user;
	next();
});

router.get('/', adminController.getDashboard);
router.get('/profile', adminController.getProfile);
router.post('/profile', requireSameOrigin, adminController.postProfile);
router.get('/settings', adminController.getSettings);

const placeholderPages = [
	['/organizations', 'Organizations', 'organizations'],
	['/users', 'Users', 'users'],
	['/onboarding', 'Onboarding', 'onboarding'],
	['/security', 'Security', 'security']
];

for (const [route, title, navigationKey] of placeholderPages) {
	router.get(route, (req, res, next) => {
		res.locals.adminPageTitle = title;
		res.locals.adminNavigationKey = navigationKey;
		next();
	}, adminController.getComingSoon);
}

module.exports = router;