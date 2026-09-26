const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const BCRYPT_ROUNDS = 12;
const dummyHash = bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS);

async function authenticateLocal(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const [rows] = await pool.execute(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.password_hash, u.status
     FROM users u
     INNER JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'local'
     WHERE u.email = ?
     LIMIT 1`,
    [normalizedEmail]
  );

  const user = rows[0];
  const hash = user?.password_hash || await dummyHash;
  const passwordMatches = await bcrypt.compare(password, hash);

  if (!user || user.status !== 'ACTIVE' || !user.password_hash || !passwordMatches) {
    return null;
  }

  await pool.execute(
    "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'ACTIVE'",
    [user.id]
  );

  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name
  };
}

async function hasPlatformRole(userId, roleCode) {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM user_platform_roles upr
     INNER JOIN platform_roles pr ON pr.id = upr.platform_role_id
     WHERE upr.user_id = ? AND pr.role_code = ?
     LIMIT 1`,
    [userId, roleCode]
  );
  return rows.length > 0;
}

async function getLoginDestination(userId) {
  if (await hasPlatformRole(userId, 'SUPER_ADMIN')) {
    return '/admin';
  }

  const [memberships] = await pool.execute(
    `SELECT 1
     FROM organization_memberships
     WHERE user_id = ? AND status = 'ACTIVE'
     LIMIT 1`,
    [userId]
  );
  return memberships.length > 0 ? '/dashboard' : null;
}

module.exports = { authenticateLocal, getLoginDestination, hasPlatformRole };