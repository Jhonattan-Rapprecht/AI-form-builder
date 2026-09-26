const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const MAX_TRACKED_ADDRESSES = 5000;

function getAddress(req) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getCurrentBucket(address, now = Date.now()) {
  let bucket = attempts.get(address);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { failures: 0, resetAt: now + WINDOW_MS };
    attempts.set(address, bucket);
  }
  return bucket;
}

function pruneExpired(now = Date.now()) {
  for (const [address, bucket] of attempts) {
    if (bucket.resetAt <= now) {
      attempts.delete(address);
    }
  }

  while (attempts.size > MAX_TRACKED_ADDRESSES) {
    attempts.delete(attempts.keys().next().value);
  }
}

const cleanupTimer = setInterval(pruneExpired, 60 * 1000);
cleanupTimer.unref();

function loginRateLimit(req, res, next) {
  pruneExpired();
  const bucket = attempts.get(getAddress(req));
  if (bucket && bucket.failures >= MAX_FAILURES) {
    res.set('Retry-After', String(Math.ceil((bucket.resetAt - Date.now()) / 1000)));
    return res.status(429).render('login', { error: null, rateLimited: true });
  }
  return next();
}

function recordFailure(req) {
  getCurrentBucket(getAddress(req)).failures += 1;
}

function clearFailures(req) {
  attempts.delete(getAddress(req));
}

module.exports = { clearFailures, loginRateLimit, recordFailure };