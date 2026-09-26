const authService = require('../services/authService');

async function requireSuperAdmin(req, res, next) {
  try {
    const allowed = await authService.hasPlatformRole(req.user.id, 'SUPER_ADMIN');
    if (!allowed) {
      return res.status(403).render('forbidden');
    }
    return next();
  } catch {
    return res.status(503).send('Authorization service temporarily unavailable.');
  }
}

module.exports = requireSuperAdmin;