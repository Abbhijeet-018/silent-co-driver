# Silent Co-Driver 

An F1 engineering tool that analyzes driver radio audio for emotional tone and stress, correlates it with lap time data, and displays insights on a live dashboard.

---

## Project Overview

Silent Co-Driver has two moving parts that need to run together:

1. **ML Model (Google Colab)** — the notebook (`speech_emotion_recognition_wit....ipynb`) handles transcription + voice emotion/stress analysis on driver radio audio, and exposes it as an API.
2. **Web App (Node.js / Express + EJS)** — the site that renders the dashboard and talks to the ML model over an API.

You need **both running at the same time** for the site to work end-to-end.

---

## Repo Structure

```
silent-co-driver/
├── public/
│   ├── script.js                    # Client-side JS
│   └── style.css                    # Site styling
├── utils/
│   └── wrapAsync.js                 # Async error-handling wrapper
├── views/
│   ├── layouts/
│   │   └── boilerplate.ejs          # Base EJS layout
│   └── home.ejs                     # Home page template
├── LICENSE
├── README.md
├── cloudConfig.js                   # Cloud/DB/storage config
├── index.js                         # Node/Express entry point
├── package.json
├── package-lock.json
└── speech_emotion_recognition_wit....ipynb   # Colab notebook (ML pipeline)
```

---

## Prerequisites

- Node.js (v18+) and npm installed
- A Google account (to run the Colab notebook)
- API keys/config needed by `cloudConfig.js` (fill in whatever it expects — DB URI, storage keys, etc.)
- Put ngrok auth-token in the speech_emotion_recognition_with_openai_whisper.ipynb. It is in the last cell of google colab.

---

##  Setup Instructions

### Step 1 — Run the ML Model on Google Colab

1. Open `speech_emotion_recognition_wit....ipynb` in [Google Colab](https://colab.research.google.com/).
2. Go to **Runtime → Run all** (or run cells top to bottom manually).
3. This will:
   - Install required packages
   - Load the speech emotion recognition pipeline
   - Start a server inside Colab and expose it publicly (typically via **ngrok**)
4. Once running, Colab will print a **public URL** (e.g. an `ngrok.io` link). **Copy this URL** — this is your ML API endpoint.

> ⚠️ This URL changes every time you restart the Colab runtime. You'll need to update it wherever the app references the ML API each time you rerun the notebook.

### Step 2 — Configure the App

1. Open `cloudConfig.js` and fill in any required values (database URI, cloud storage keys, etc.).
2. Wherever the ML API URL is referenced in the code (e.g. in `index.js` or `utils/wrapAsync.js`), update it to the fresh Colab/ngrok URL from Step 1 — ideally via a `.env` file:
   ```
   ML_API_URL=https://your-ngrok-url-from-colab.ngrok-free.app
   PORT=3000
   ```

### Step 3 — Install Dependencies

From the project root:

```bash
npm install
```

### Step 4 — Run the App

From the project root:

```bash
node index.js
```

You should see something like:
```
Server running on port 3000
```

### Step 5 — Open the Site

Visit `http://localhost:3000` in your browser. The EJS views (`views/home.ejs`) will render, and the app will call the ML model running on Colab via the `ML_API_URL`.

---

## Typical Run Order (Every Time)

1. Open the Colab notebook → Run all → copy the new ngrok URL
2. Update `ML_API_URL` with the fresh link
3. `node index.js`
4. Open `http://localhost:3000`

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Site loads but no ML data | Check `ML_API_URL` matches the current Colab ngrok link |
| Colab session disconnects | Free Colab sessions time out after inactivity — rerun all cells and update the URL |
| CORS errors | Ensure the Colab server has CORS enabled for your app's origin |
| Config/connection errors on start | Double-check values in `cloudConfig.js` |

---

## Notes

- Keep the Colab tab open while demoing — closing it kills the ML API.
- For a hackathon demo, consider recording a backup video in case the Colab/ngrok connection drops live.
