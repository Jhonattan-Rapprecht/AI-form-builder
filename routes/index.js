const express = require('express');

const router = express.Router();

const formsRouter = require('./api/forms');
const aiRouter = require('./api/ai');

router.use('/forms', formsRouter);
router.use('/ai', aiRouter);

module.exports = router;
