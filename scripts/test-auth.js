const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('path');
const readline = require('readline/promises');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../config/database');
const app = require('../app');
const sessionService = require('../services/sessionService');
const cookieName = sessionService.COOKIE_NAME;

function promptHidden(label) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Run the authentication test in an interactive terminal.'));
  }

  process.stdout.write(label);
  input.setEncoding('utf8');
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = '';
    const finish = error => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = data => {
      for (const character of data) {
        if (character === '\u0003') return finish(new Error('Authentication test cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') {
          value = Array.from(value).slice(0, -1).join('');
        } else if (character >= ' ') {
          value += character;
        }
      }
    };
    input.on('data', onData);
  });
}

function check(description, condition) {
  assert.ok(condition, description);
  console.log(`PASS ${description}`);
}

function formBody(email, password) {
  return new URLSearchParams({ email, password }).toString();
}

async function run() {
  const temporaryEmail = `auth-test-${crypto.randomUUID()}@example.invalid`;
  const disabledEmail = `auth-disabled-${crypto.randomUUID()}@example.invalid`;
  const temporaryPassword = `${crypto.randomBytes(20).toString('base64url')}Aa1!`;
  const temporaryHash = await bcrypt.hash(temporaryPassword, 12);
  const temporaryUserIds = [];
  let server;
  let superAdminPassword = await promptHidden('Existing Super Admin password (input hidden): ');

  try {
    const [admins] = await pool.execute(
      `SELECT u.id, u.email
       FROM users u
       INNER JOIN user_platform_roles upr ON upr.user_id = u.id
       INNER JOIN platform_roles pr ON pr.id = upr.platform_role_id
       WHERE pr.role_code = 'SUPER_ADMIN' AND u.status = 'ACTIVE'
       LIMIT 1`
    );
    if (admins.length === 0) {
      throw new Error('No active Super Administrator was found for the integration test.');
    }
    const superAdmin = admins[0];

    for (const [email, status] of [[temporaryEmail, 'ACTIVE'], [disabledEmail, 'DISABLED']]) {
      const [result] = await pool.execute(
        'INSERT INTO users (email, password_hash, status) VALUES (?, ?, ?)',
        [email, temporaryHash, status]
      );
      temporaryUserIds.push(result.insertId);
      await pool.execute(
        `INSERT INTO auth_identities (user_id, provider, provider_subject, provider_email)
         VALUES (?, 'local', ?, ?)`,
        [result.insertId, email, email]
      );
    }

    await new Promise(resolve => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const origin = { origin: baseUrl };
    const postLogin = (email, password, cookie) => fetch(`${baseUrl}/login`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        ...origin,
        'content-type': 'application/x-www-form-urlencoded',
        ...(cookie ? { cookie } : {})
      },
      body: formBody(email, password)
    });

    const loginPage = await fetch(`${baseUrl}/login`);
    check('GET /login renders the local sign-in form', loginPage.status === 200 && /name="password"/.test(await loginPage.text()));

    const anonymousAdmin = await fetch(`${baseUrl}/admin`, { redirect: 'manual' });
    check('Unauthenticated GET /admin redirects to /login',
      anonymousAdmin.status === 302 && anonymousAdmin.headers.get('location') === '/login');

    const invalidLogin = await postLogin(superAdmin.email, `${superAdminPassword}-invalid`);
    const genericErrorPage = await fetch(`${baseUrl}/login?error=1`);
    const genericErrorText = await genericErrorPage.text();
    check('Invalid credentials receive a generic error',
      invalidLogin.status === 302 && invalidLogin.headers.get('location') === '/login?error=1' &&
      genericErrorText.includes('Invalid email or password.') && !genericErrorText.includes(superAdmin.email));

    const fixationToken = 'a'.repeat(64);
    const validLogin = await postLogin(superAdmin.email, superAdminPassword, `${cookieName}=${fixationToken}`);
    const setCookie = validLogin.headers.get('set-cookie') || '';
    const authenticatedCookie = setCookie.split(';')[0];
    const authenticatedToken = authenticatedCookie.slice(`${cookieName}=`.length);
    check('Valid Super Admin login redirects to /admin and rotates the session token',
      validLogin.status === 302 && validLogin.headers.get('location') === '/admin' &&
      authenticatedToken.length === 64 && authenticatedToken !== fixationToken);
    check('Session cookie is HttpOnly and SameSite=Lax',
      /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie));

    const sessionHash = crypto.createHash('sha256').update(authenticatedToken).digest('hex');
    const [sessionRows] = await pool.execute(
      'SELECT token_hash, expires_at FROM sessions WHERE token_hash = ?',
      [sessionHash]
    );
    check('Session is stored server-side as a hash with an expiry',
      sessionRows.length === 1 && sessionRows[0].token_hash !== authenticatedToken &&
      new Date(sessionRows[0].expires_at).getTime() > Date.now());

    const [hashRows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [superAdmin.id]);
    check('Super Admin password remains bcrypt-hashed in the database',
      hashRows.length === 1 && /^\$2[aby]\$/.test(hashRows[0].password_hash) &&
      hashRows[0].password_hash !== superAdminPassword);

    const authenticatedAdmin = await fetch(`${baseUrl}/admin`, {
      headers: { cookie: authenticatedCookie }
    });
    check('Authenticated Super Admin can access /admin',
      authenticatedAdmin.status === 200 && (await authenticatedAdmin.text()).includes('Super Admin authentication successful.'));

    const invalidOriginLogout = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      redirect: 'manual',
      headers: { cookie: authenticatedCookie, origin: 'https://invalid.example' }
    });
    check('Cross-origin logout is rejected', invalidOriginLogout.status === 403);

    const logout = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      redirect: 'manual',
      headers: { ...origin, cookie: authenticatedCookie }
    });
    check('POST /logout clears the authentication cookie',
      logout.status === 302 && logout.headers.get('location') === '/login' && /Max-Age=0/i.test(logout.headers.get('set-cookie') || ''));

    const adminAfterLogout = await fetch(`${baseUrl}/admin`, {
      redirect: 'manual',
      headers: { cookie: authenticatedCookie }
    });
    const [invalidatedRows] = await pool.execute('SELECT 1 FROM sessions WHERE token_hash = ?', [sessionHash]);
    check('Logout invalidates the server-side session and blocks reuse',
      adminAfterLogout.status === 302 && adminAfterLogout.headers.get('location') === '/login' && invalidatedRows.length === 0);

    const disabledLogin = await postLogin(disabledEmail, temporaryPassword);
    check('Disabled accounts cannot log in and receive the generic error',
      disabledLogin.status === 302 && disabledLogin.headers.get('location') === '/login?error=1');

    const activeTestUserId = temporaryUserIds[0];
    const nonAdminToken = await sessionService.createSession(activeTestUserId, {
      get: () => null,
      ip: '127.0.0.1'
    });
    const nonAdminResponse = await fetch(`${baseUrl}/admin`, {
      redirect: 'manual',
      headers: { cookie: `${cookieName}=${nonAdminToken}` }
    });
    check('Authenticated non-Super-Admin is denied by server-side role authorization', nonAdminResponse.status === 403);

    let throttledResponse;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      throttledResponse = await postLogin(temporaryEmail, `${temporaryPassword}-invalid`);
      if (throttledResponse.status === 429) {
        break;
      }
    }
    check('Repeated failed logins are rate limited without locking the account',
      throttledResponse.status === 429 && Number(throttledResponse.headers.get('retry-after')) > 0);

    console.log('Authentication integration test completed. Temporary test accounts will be removed.');
  } finally {
    superAdminPassword = '';
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    if (temporaryUserIds.length > 0) {
      await pool.query('DELETE FROM users WHERE id IN (?)', [temporaryUserIds]);
    }
    await pool.end();
  }
}

run().catch(error => {
  console.error(`Authentication integration test failed${error.code ? ` (${error.code})` : ''}.`);
  if (!error.code && !/password|email/i.test(error.message)) {
    console.error(error.message);
  }
  process.exitCode = 1;
});