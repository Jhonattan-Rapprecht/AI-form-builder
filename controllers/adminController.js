const adminService = require('../services/adminService');

function formatTimestamp(value) {
  if (!value) return 'Never';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function renderPage(res, view, locals) {
  return res.render(view, {
    currentUser: res.locals.currentUser,
    ...locals
  });
}

function getDashboard(req, res) {
  return renderPage(res, 'admin/dashboard', {
    title: 'Dashboard',
    activeNavigation: 'dashboard'
  });
}

async function getProfile(req, res) {
  try {
    const profile = await adminService.getSuperAdminProfile(req.user.id);
    if (!profile) return res.status(404).render('404', { url: req.originalUrl });

    return renderPage(res, 'admin/profile', {
      title: 'My Profile',
      activeNavigation: 'profile',
      profile: {
        ...profile,
        createdAtLabel: formatTimestamp(profile.created_at),
        lastLoginLabel: formatTimestamp(profile.last_login_at)
      },
      notice: req.query.updated === '1' ? 'Profile details updated.' : null,
      error: null
    });
  } catch {
    return res.status(503).send('Profile service temporarily unavailable.');
  }
}

async function postProfile(req, res) {
  const firstName = typeof req.body.first_name === 'string' ? req.body.first_name.trim() : '';
  const lastName = typeof req.body.last_name === 'string' ? req.body.last_name.trim() : '';
  const invalidLength = [firstName, lastName].some(value => Array.from(value).length > 100);

  try {
    const profile = await adminService.getSuperAdminProfile(req.user.id);
    if (!profile) return res.status(404).render('404', { url: req.originalUrl });

    if (invalidLength) {
      return renderPage(res, 'admin/profile', {
        title: 'My Profile',
        activeNavigation: 'profile',
        profile: {
          ...profile,
          createdAtLabel: formatTimestamp(profile.created_at),
          lastLoginLabel: formatTimestamp(profile.last_login_at)
        },
        notice: null,
        error: 'Names must be 100 characters or fewer.'
      });
    }

    const updated = await adminService.updateSuperAdminName(
      req.user.id,
      firstName || null,
      lastName || null
    );
    if (!updated) return res.status(403).render('forbidden');
    return res.redirect('/admin/profile?updated=1');
  } catch {
    return res.status(503).send('Profile service temporarily unavailable.');
  }
}

function getSettings(req, res) {
  return renderPage(res, 'admin/settings', {
    title: 'System Settings',
    activeNavigation: 'settings'
  });
}

function getComingSoon(req, res) {
  return renderPage(res, 'admin/coming-soon', {
    title: res.locals.adminPageTitle,
    activeNavigation: res.locals.adminNavigationKey
  });
}

module.exports = { getComingSoon, getDashboard, getProfile, getSettings, postProfile };