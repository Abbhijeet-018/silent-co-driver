const express = require('express');
const predict = express.Router();
const model = require('../Model/audio.js');

predict.post('/predict', (req, res) => {
    const { title, audio, stresslevel, owner } = req.body;
    if (!title || !audio || !stresslevel || !owner) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    const newAudio = new model({
        title,
        audio,
        stresslevel,
        owner
    });
    newAudio.save()
        .then(savedAudio => res.status(201).json(savedAudio))
        .catch(err => res.status(500).json({ message: 'Error saving audio', error: err.message }));
})

module.exports = predict;