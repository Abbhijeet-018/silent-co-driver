require('dotenv').config();
const express = require('express');
const session = require('express-session');
const wrapAsync = require('./utils/wrapAsync');
const app = express();
const port = 3000;
const path = require("path");
const router = require('./router/predict');
const FormData = require('form-data');
const axios = require('axios');
const mongoose = require('mongoose');
const { storage } = require('./cloudConfig.js');
const multer = require('multer');
const upload = multer({ storage });
const audioModel = require('./Model/audio.js');
app.use(session({
    secret: "jhkjb",
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    }
}))
mongoose.connect('mongodb://127.0.0.1:27017/F1_hackathon')
    .then(() => console.log('MongoDB connected successfully!'))
    .catch(err => console.error('Connection error:', err));

// Middleware to parse JSON request bodies
app.use(express.json());
// Middleware to parse URL-encoded bodies (form submissions)
app.use(express.urlencoded({ extended: true }));

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

app.set("view engine", 'ejs');
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use("/predict", router);

app.post("/upload-audio", upload.single('audio'), wrapAsync(async (req, res) => {
    if (!req.file) {
        return res.status(400).send("No audio file uploaded");
    }
    const audioUrl = req.file.path; // Cloudinary URL
    const newAudio = new audioModel({
        title: req.file.originalname,
        audio: audioUrl,
        owner: req.user
    })
    await newAudio.save();
    try {
        // Download the file from Cloudinary as a buffer (much more reliable for form-data than a stream)
        const audioData = await axios.get(audioUrl, { responseType: 'arraybuffer' });

        const form = new FormData();
        form.append("file", audioData.data, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        // Ngrok blocks automated requests with a warning page unless this header is provided
        const headers = form.getHeaders();
        headers['ngrok-skip-browser-warning'] = 'true';
        headers['User-Agent'] = 'Node.js/Axios';

        const response = await axios.post(
            "process.env.ML_MODEL",
            form,
            {
                headers: headers
            }
        );

        let transcript = "";
        try {
            const groqForm = new FormData();
            groqForm.append("file", audioData.data, {
                filename: req.file.originalname,
                contentType: req.file.mimetype
            });
            groqForm.append("model", "whisper-large-v3-turbo");
            
            const groqRes = await axios.post("https://api.groq.com/openai/v1/audio/transcriptions", groqForm, {
                headers: {
                    ...groqForm.getHeaders(),
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
                }
            });
            transcript = groqRes.data.text;
        } catch (e) {
            console.error("Groq Transcription Error:", e.response ? e.response.data : e.message);
            transcript = "Transcription failed. Please ensure GROQ_API_KEY is set in .env.";
        }

        res.json({
            ...response.data,
            transcript: transcript
        });

    } catch (error) {
        console.error("ML API Error:", error.message);
        res.status(500).json({
            error: "Audio model failed",
            details: error.response ? error.response.data : error.message
        });
    }
}))

app.get("/", (req, res) => {
    res.render("home");
});

// Global error handler so frontend fetch receives JSON instead of HTML
app.use((err, req, res, next) => {
    console.error("Global Error Caught:", err);
    res.status(500).json({ success: false, error: "Server Error", details: err.message });
});
