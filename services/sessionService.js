const crypto = require('crypto');
const pool = require('../config/database');

const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-afb_session' : 'afb_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

function getTokenFromRequest(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (separator < 0 || cookie.slice(0, separator).trim() !== COOKIE_NAME) {
      continue;
    }

    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setSessionCookie(res, token) {
  const cookieParts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax'
  ];

  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function clearSessionCookie(res) {
  const cookieParts = [`${COOKIE_NAME}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

async function createSession(userId, req) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const userAgent = req.get('user-agent')?.slice(0, 512) || null;
  const ipAddress = req.ip?.slice(0, 45) || null;

  await pool.query('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP');
  await pool.execute(
    `INSERT INTO sessions (user_id, token_hash, expires_at, last_activity_at, user_agent, ip_address)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
    [userId, tokenHash, expiresAt, userAgent, ipAddress]
  );

  return token;
}

async function loadSessionUser(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  const tokenHash = hashToken(token);
  const [rows] = await pool.execute(
    `SELECT s.id AS session_id, u.id, u.email, u.first_name, u.last_name
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?
       AND s.expires_at > CURRENT_TIMESTAMP
       AND u.status = 'ACTIVE'
     LIMIT 1`,
    [tokenHash]
  );

  if (rows.length === 0) {
    return null;
  }

  await pool.execute(
    `UPDATE sessions
     SET last_activity_at = CURRENT_TIMESTAMP
     WHERE id = ? AND last_activity_at < CURRENT_TIMESTAMP - INTERVAL 5 MINUTE`,
    [rows[0].session_id]
  );

  return {
    id: rows[0].id,
    email: rows[0].email,
    firstName: rows[0].first_name,
    lastName: rows[0].last_name
  };
}

async function invalidateSession(token) {
  if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
    await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
  }
}

module.exports = {
  COOKIE_NAME,
  clearSessionCookie,
  createSession,
  getTokenFromRequest,
  invalidateSession,
  loadSessionUser,
  setSessionCookie
};