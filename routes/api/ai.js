const express = require('express');

const router = express.Router();

router.post('/generate', async (req, res) => {
    const { prompt } = req.body;

    res.json({
        response: `Dummy AI response for prompt: ${prompt}`
    });
});

module.exports = router;
