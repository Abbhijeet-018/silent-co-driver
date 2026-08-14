const axios = require('axios');
const fs = require('fs');

async function test() {
    try {
        const res = await axios.post("https://api-inference.huggingface.co/models/openai/whisper-tiny.en", Buffer.from("test"), {
            headers: {
                "Content-Type": "audio/wav"
            }
        });
        console.log(res.data);
    } catch (e) {
        console.log("Error:", e.response ? e.response.data : e.message);
    }
}
test();
