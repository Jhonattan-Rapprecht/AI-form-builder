const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
    res.json({
        message: 'Forms API placeholder',
        forms: []
    });
});

router.post('/', (req, res) => {
    const form = req.body;

    res.status(201).json({
        message: 'Form created',
        form
    });
});

module.exports = router;
