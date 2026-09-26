const path = require('path');
const readline = require('readline/promises');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_BYTES = 72;
const BCRYPT_ROUNDS = 12;

function promptEmail() {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  return prompt.question('Super Administrator email: ').finally(() => prompt.close());
}

function promptHidden(label) {
  const input = process.stdin;

  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Password entry requires an interactive terminal.'));
  }

  process.stdout.write(label);
  input.setEncoding('utf8');
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = '';

    function finish(error) {
      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    }

    function onData(data) {
      for (const character of data) {
        if (character === '\u0003') {
          finish(new Error('Password entry cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = Array.from(value).slice(0, -1).join('');
        } else if (character >= ' ') {
          value += character;
        }
      }
    }

    input.on('data', onData);
  });
}

function validateEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Enter a valid email address.');
  }
  return normalizedEmail;
}

function validatePassword(password) {
  if (Array.from(password).length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    throw new Error(`Password must be no more than ${PASSWORD_MAX_BYTES} UTF-8 bytes for bcrypt.`);
  }
}

async function hasSuperAdministrator(connection) {
  const [rows] = await connection.execute(
    `SELECT 1
     FROM user_platform_roles upr
     INNER JOIN platform_roles pr ON pr.id = upr.platform_role_id
     WHERE pr.role_code = ?
     LIMIT 1`,
    ['SUPER_ADMIN']
  );
  return rows.length > 0;
}

async function createSuperAdministrator() {
  if (!Object.prototype.hasOwnProperty.call(process.env, 'DB_PASSWORD')) {
    throw new Error('DB_PASSWORD is not set in .env.');
  }

  const pool = require('../config/database');
  let connection;
  let lockAcquired = false;
  let inTransaction = false;

  try {
    connection = await pool.getConnection();

    if (await hasSuperAdministrator(connection)) {
      console.log('A Super Administrator already exists. No account or password was changed.');
      return;
    }

    const email = validateEmail(await promptEmail());
    let password = await promptHidden(`Password (hidden, at least ${PASSWORD_MIN_LENGTH} characters): `);
    const confirmation = await promptHidden('Confirm password (input hidden): ');

    if (password !== confirmation) {
      throw new Error('The passwords did not match. No account was created.');
    }
    validatePassword(password);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    password = '';

    const lockName = `create-superadmin:${process.env.DB_NAME || 'ai_formbuilder'}`;
    const [lockRows] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    if (lockRows[0].acquired !== 1) {
      throw new Error('Could not acquire the bootstrap lock. Try again shortly.');
    }
    lockAcquired = true;

    await connection.beginTransaction();
    inTransaction = true;

    await connection.execute(
      `INSERT IGNORE INTO platform_roles (role_code, description)
       VALUES (?, ?)`,
      ['SUPER_ADMIN', 'Platform-level administrator']
    );
    const [roleRows] = await connection.execute(
      'SELECT id FROM platform_roles WHERE role_code = ? FOR UPDATE',
      ['SUPER_ADMIN']
    );
    if (roleRows.length !== 1) {
      throw new Error('The SUPER_ADMIN platform role could not be loaded.');
    }

    if (await hasSuperAdministrator(connection)) {
      await connection.rollback();
      inTransaction = false;
      console.log('A Super Administrator already exists. No account or password was changed.');
      return;
    }

    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
      [email]
    );
    if (existingUsers.length > 0) {
      await connection.rollback();
      inTransaction = false;
      console.log('An account with that email already exists. No account or password was changed.');
      return;
    }

    const [userResult] = await connection.execute(
      `INSERT INTO users (email, password_hash, status)
       VALUES (?, ?, 'ACTIVE')`,
      [email, passwordHash]
    );
    const userId = userResult.insertId;

    await connection.execute(
      `INSERT INTO auth_identities (user_id, provider, provider_subject, provider_email)
       VALUES (?, 'local', ?, ?)`,
      [userId, email, email]
    );
    await connection.execute(
      'INSERT INTO user_platform_roles (user_id, platform_role_id) VALUES (?, ?)',
      [userId, roleRows[0].id]
    );

    const [verificationRows] = await connection.execute(
      `SELECT u.status, u.password_hash, pr.role_code, ai.provider,
              ai.provider_subject, COUNT(om.id) AS organization_memberships
       FROM users u
       INNER JOIN user_platform_roles upr ON upr.user_id = u.id
       INNER JOIN platform_roles pr ON pr.id = upr.platform_role_id
       INNER JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'local'
       LEFT JOIN organization_memberships om ON om.user_id = u.id
       WHERE u.id = ?
       GROUP BY u.id, u.status, u.password_hash, pr.role_code,
                ai.provider, ai.provider_subject`,
      [userId]
    );
    const verified = verificationRows[0];
    const hashMatches = verified && await bcrypt.compare(confirmation, verified.password_hash);

    if (
      !verified ||
      verified.status !== 'ACTIVE' ||
      verified.role_code !== 'SUPER_ADMIN' ||
      verified.provider !== 'local' ||
      verified.provider_subject !== email ||
      Number(verified.organization_memberships) !== 0 ||
      !verified.password_hash ||
      verified.password_hash === confirmation ||
      !hashMatches
    ) {
      throw new Error('Super Administrator verification failed; the transaction was rolled back.');
    }

    await connection.commit();
    inTransaction = false;
    console.log('Super Administrator created and verified successfully.');
    console.log('Verified: active user, bcrypt password hash, local identity, SUPER_ADMIN role, no organization membership.');
    console.log('No password or password hash was displayed.');
  } catch (error) {
    if (connection && inTransaction) {
      await connection.rollback();
      inTransaction = false;
    }
    throw error;
  } finally {
    if (connection && lockAcquired) {
      await connection.execute('SELECT RELEASE_LOCK(?)', [
        `create-superadmin:${process.env.DB_NAME || 'ai_formbuilder'}`
      ]);
    }
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

createSuperAdministrator().catch(error => {
  console.error(`Super Administrator bootstrap failed${error.code ? ` (${error.code})` : ''}.`);
  if (!error.code) {
    console.error(error.message);
  }
  process.exitCode = 1;
});