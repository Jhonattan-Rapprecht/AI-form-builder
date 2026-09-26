const express = require("express");
const router = express.Router();
const authRouter = require('./auth');
const adminRouter = require('./admin');

/* ---------- Public Pages ---------- */

// Root � the "under construction" page.
router.get("/", (req, res) => {
  res.render("construction");
});

router.use('/', authRouter);
router.use('/admin', adminRouter);

/* ---------- API Routes ---------- */

const formsRouter = require("./api/forms");
const aiRouter   = require("./api/ai");

/**
 * All API routes are prefixed with `/api`.
 * If you want to expose a non-API route in the future,
 * add it **before** the `/api` group.
 */
router.use("/api/forms", formsRouter);
router.use("/api/ai", aiRouter);

/* ---------- Optional: 404 handler ---------- */

/**
 * If the request didn't match any route above,
 * send a friendly 404 page.  Create a
 * `views/404.ejs` (or whatever template engine you use).
 */
router.use((req, res) => {
  res.status(404).render("404", { url: req.originalUrl });
});

module.exports = router;
