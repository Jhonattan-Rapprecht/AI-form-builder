const sessionService = require('../services/sessionService');

async function requireAuth(req, res, next) {
  const token = sessionService.getTokenFromRequest(req);
  if (!token) {
    return res.redirect('/login');
  }

  try {
    const user = await sessionService.loadSessionUser(token);
    if (!user) {
      await sessionService.invalidateSession(token);
      sessionService.clearSessionCookie(res);
      return res.redirect('/login');
    }

    req.user = user;
    return next();
  } catch {
    return res.status(503).send('Authentication service temporarily unavailable.');
  }
}

module.exports = requireAuth;