require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testGroq() {
    console.log("Key:", process.env.GROQ_API_KEY ? "Loaded" : "Missing");
    // just check if key works with a dummy request (might get format error, but key auth will pass)
    try {
        const form = new FormData();
        form.append("file", Buffer.from("dummy data"), { filename: "test.wav", contentType: "audio/wav" });
        form.append("model", "whisper-large-v3-turbo");

        const groqRes = await axios.post("https://api.groq.com/openai/v1/audio/transcriptions", form, {
            headers: {
                ...form.getHeaders(),
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
            }
        });
        console.log("Success:", groqRes.data);
    } catch (e) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
}
testGroq();
