const authService = require('../services/authService');
const sessionService = require('../services/sessionService');
const loginRateLimit = require('../middleware/loginRateLimit');

function getLogin(req, res) {
  return res.render('login', {
    error: req.query.error === '1' ? 'Invalid email or password.' : null,
    rateLimited: false
  });
}

async function postLogin(req, res) {
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || email.length > 254 || !password || Buffer.byteLength(password, 'utf8') > 72) {
    loginRateLimit.recordFailure(req);
    return res.redirect('/login?error=1');
  }

  try {
    const user = await authService.authenticateLocal(email, password);
    if (!user) {
      loginRateLimit.recordFailure(req);
      return res.redirect('/login?error=1');
    }

    const destination = await authService.getLoginDestination(user.id);
    if (!destination) {
      loginRateLimit.recordFailure(req);
      return res.redirect('/login?error=1');
    }

    const previousToken = sessionService.getTokenFromRequest(req);
    if (previousToken) {
      await sessionService.invalidateSession(previousToken);
    }

    const newToken = await sessionService.createSession(user.id, req);
    sessionService.setSessionCookie(res, newToken);
    loginRateLimit.clearFailures(req);
    return res.redirect(destination);
  } catch {
    return res.status(503).render('login', {
      error: 'Sign-in is temporarily unavailable. Please try again later.',
      rateLimited: false
    });
  }
}

async function postLogout(req, res) {
  try {
    await sessionService.invalidateSession(sessionService.getTokenFromRequest(req));
    sessionService.clearSessionCookie(res);
    return res.redirect('/login');
  } catch {
    return res.status(503).send('Sign-out is temporarily unavailable.');
  }
}

module.exports = { getLogin, postLogin, postLogout };