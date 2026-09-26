function getAdminTestPage(req, res) {
  return res.render('admin-test', { user: req.user });
}

module.exports = { getAdminTestPage };