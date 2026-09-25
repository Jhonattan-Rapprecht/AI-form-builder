const express = require('express');

const router = express.Router();


// Main page route / under construction





// API routes


/* API route definitions */

const formsRouter = require('./api/forms');
const aiRouter = require('./api/ai');


/* API route usage */

router.use('/forms', formsRouter);
router.use('/ai', aiRouter);

module.exports = router;
