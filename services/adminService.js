const pool = require('../config/database');

async function getSuperAdminProfile(userId) {
  const [rows] = await pool.execute(
    `SELECT u.first_name, u.last_name, u.email, u.status,
            u.last_login_at, u.created_at, pr.role_code AS platform_role
     FROM users u
     INNER JOIN user_platform_roles upr ON upr.user_id = u.id
     INNER JOIN platform_roles pr ON pr.id = upr.platform_role_id
     WHERE u.id = ? AND pr.role_code = 'SUPER_ADMIN'
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function updateSuperAdminName(userId, firstName, lastName) {
  await pool.execute(
    `UPDATE users
     SET first_name = ?, last_name = ?
     WHERE id = ? AND status = 'ACTIVE'
       AND EXISTS (
         SELECT 1
         FROM user_platform_roles upr
         INNER JOIN platform_roles pr ON pr.id = upr.platform_role_id
         WHERE upr.user_id = users.id AND pr.role_code = 'SUPER_ADMIN'
       )`,
    [firstName, lastName, userId]
  );
  const [rows] = await pool.execute(
    `SELECT 1
     FROM users u
     WHERE u.id = ? AND u.status = 'ACTIVE'
       AND EXISTS (
         SELECT 1
         FROM user_platform_roles upr
         INNER JOIN platform_roles pr ON pr.id = upr.platform_role_id
         WHERE upr.user_id = u.id AND pr.role_code = 'SUPER_ADMIN'
       )
     LIMIT 1`,
    [userId]
  );
  return rows.length > 0;
}

module.exports = { getSuperAdminProfile, updateSuperAdminName };