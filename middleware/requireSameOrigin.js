function requireSameOrigin(req, res, next) {
  const originHeader = req.get('origin');
  const refererHeader = req.get('referer');
  const source = originHeader || refererHeader;

  if (!source || !req.get('host')) {
    return res.status(403).send('Request origin could not be verified.');
  }

  try {
    const sourceOrigin = new URL(source).origin;
    const expectedOrigin = `${req.secure ? 'https' : 'http'}://${req.get('host')}`;
    if (sourceOrigin !== expectedOrigin) {
      return res.status(403).send('Request origin could not be verified.');
    }
  } catch {
    return res.status(403).send('Request origin could not be verified.');
  }

  return next();
}

module.exports = requireSameOrigin;