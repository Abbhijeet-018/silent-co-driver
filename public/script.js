(function () {
    "use strict";
    var activeAudio = null;
    var audioUrl = null;
    var lapsData = [
        { timeStr: '' },
        { timeStr: '' },
        { timeStr: '' },
        { timeStr: '' }
    ];

    var activeClip = {
        name: 'NO AUDIO LOADED',
        durationStr: 'DURATION: --:--',
        stressLapIndex: -1, // No hardcoded stress event by default
        flagText: 'NO AUDIO ANALYZED',
        calmVal: 'Calm --',
        stressVal: 'Stressed --',
        tiredVal: 'Tired --',
        transcript: [
            { time: '00:00.0', text: 'Upload an audio recording or select a sample clip to run acoustic stress analysis.', alert: false }
        ]
    };

    // Helper: Parse Lap Time string into total seconds
    function parseLapTimeToSeconds(str) {
        if (!str || typeof str !== "string") return null;
        var clean = str.trim();
        if (!clean) return null;

        if (clean.indexOf(":") !== -1) {
            var parts = clean.split(":");
            if (parts.length !== 2) return null;
            var m = parseFloat(parts[0]);
            var s = parseFloat(parts[1]);
            if (isNaN(m) || isNaN(s)) return null;
            return (m * 60) + s;
        } else {
            var secs = parseFloat(clean);
            if (isNaN(secs) || secs <= 0) return null;
            return secs;
        }
    }

    // Helper: Format seconds to M:SS.mmm
    function formatSecondsToLapTime(totalSecs) {
        if (totalSecs === null || isNaN(totalSecs)) return "--:--.---";
        var m = Math.floor(totalSecs / 60);
        var s = (totalSecs % 60).toFixed(3);
        return m + ":" + (s < 10 ? "0" + s : s);
    }

    function getStressLapIndex(validLaps) {
        // Check for difference between successive laps > 0.3s
        for (var i = 0; i < validLaps.length - 1; i++) {
            if (validLaps[i + 1].sec - validLaps[i].sec > 0.3) {
                return validLaps[i + 1].index;
            }
        }

        // If a preset explicitly set a stress lap, use it
        if (activeClip.stressLapIndex >= 0) return activeClip.stressLapIndex;

        // Otherwise, dynamically infer based on emotion and lap times
        if (activeClip.emotion && ["angry", "sad", "fear", "fearful", "disgust"].includes(activeClip.emotion.toLowerCase())) {
            var timesList = validLaps.map(function (v) { return v.sec; });
            var bestTime = Math.min.apply(null, timesList);
            var worstLap = validLaps.reduce(function (worst, current) {
                return current.sec > worst.sec ? current : worst;
            }, validLaps[0]);

            // At least 0.15s loss to flag as the stress lap
            if (worstLap && (worstLap.sec - bestTime) > 0.15) {
                return worstLap.index;
            }
        }
        return -1;
    }

    /* ---------- DYNAMIC LAP CORRELATION CHART (USER INPUT DRIVEN) ---------- */
    function renderDynamicLapChart() {
        var container = document.getElementById("lap-chart-container");
        if (!container) return;

        // Extract valid numerical seconds ONLY from non-empty user inputs
        var validLaps = [];
        lapsData.forEach(function (item, idx) {
            var sec = parseLapTimeToSeconds(item.timeStr);
            if (sec !== null) {
                validLaps.push({ index: idx, lapNum: idx + 1, sec: sec });
            }
        });

        if (validLaps.length === 0) {
            container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-400); font-family: var(--font-mono); font-size: 11px;">ENTER LAP TIMES ABOVE TO GENERATE GRAPH VISUALIZATION</div>';
            updateInsightText([], null);
            return;
        }

        var times = validLaps.map(function (v) { return v.sec; });
        var n = validLaps.length;
        var W = 480, H = 200, L = 42, R = 16, T = 22, B = 30;

        var minSec = Math.min.apply(null, times);
        var maxSec = Math.max.apply(null, times);

        if (minSec === maxSec) {
            minSec -= 0.5;
            maxSec += 0.5;
        } else {
            minSec = Math.floor((minSec - 0.2) * 2) / 2;
            maxSec = Math.ceil((maxSec + 0.2) * 2) / 2;
        }

        var px = function (i) { return L + i * ((W - L - R) / Math.max(1, n - 1)); };
        var py = function (t) { return T + ((maxSec - t) / (maxSec - minSec)) * (H - T - B); };

        // Grid lines
        var grid = "";
        var step = (maxSec - minSec) / 4;
        for (var g = minSec; g <= maxSec + 0.01; g += step) {
            var gy = py(g);
            var lbl = formatSecondsToLapTime(g);
            grid += '<line x1="' + L + '" y1="' + gy.toFixed(1) + '" x2="' + (W - R) + '" y2="' + gy.toFixed(1) + '" stroke="#1E2228" stroke-width="1"/>' +
                '<text x="' + (L - 6) + '" y="' + (gy + 3).toFixed(1) + '" fill="#8A919A" font-family="JetBrains Mono" font-size="9" text-anchor="end">' + lbl + '</text>';
        }

        var inferredStressLapIdx = getStressLapIndex(validLaps);

        // Highlight Stress Lap if present in current laps
        var band = "";
        var stressLapObj = validLaps.find(function (v) { return v.index === inferredStressLapIdx; });

        if (stressLapObj) {
            var sIdx = validLaps.indexOf(stressLapObj);
            var sx0 = px(Math.max(0, sIdx - 0.4));
            var sx1 = px(Math.min(n - 1, sIdx + 0.4));
            band = '<rect x="' + sx0.toFixed(1) + '" y="' + T + '" width="' + (sx1 - sx0).toFixed(1) + '" height="' + (H - T - B) + '" fill="rgba(255,85,70,0.12)"/>' +
                '<text x="' + ((sx0 + sx1) / 2).toFixed(1) + '" y="' + (T + 11) + '" fill="#FF5546" font-family="JetBrains Mono" font-size="9" font-weight="600" text-anchor="middle" letter-spacing="1">STRESS EVENT</text>';
        }

        // Best lap reference line
        var bestSec = Math.min.apply(null, times);
        var bestY = py(bestSec);
        var dashes = '<line x1="' + L + '" y1="' + bestY.toFixed(1) + '" x2="' + (W - R) + '" y2="' + bestY.toFixed(1) + '" stroke="#333A42" stroke-dasharray="3 3"/>' +
            '<text x="' + (W - R) + '" y="' + (bestY - 4).toFixed(1) + '" fill="#5C636B" font-family="JetBrains Mono" font-size="9" text-anchor="end">BEST ' + formatSecondsToLapTime(bestSec) + '</text>';

        // Polyline connecting points
        var pointsStr = validLaps.map(function (v, i) {
            return px(i).toFixed(1) + "," + py(v.sec).toFixed(1);
        }).join(" ");

        var polyline = n > 1 ? '<polyline points="' + pointsStr + '" fill="none" stroke="#2BC8D8" stroke-width="1.8"/>' : '';

        // Dots & Labels
        var dots = validLaps.map(function (v, i) {
            var isStress = v.index === inferredStressLapIdx;
            var col = isStress ? "#FF5546" : "#2BC8D8";
            var r = isStress ? 4 : 2.5;
            return '<circle cx="' + px(i).toFixed(1) + '" cy="' + py(v.sec).toFixed(1) + '" r="' + r + '" fill="' + col + '"/>';
        }).join("");

        var lapLabels = validLaps.map(function (v, i) {
            var x = px(i);
            return '<text x="' + x.toFixed(1) + '" y="' + (H - 8) + '" fill="' + (v.index === inferredStressLapIdx ? "#FF5546" : "#8A919A") + '" font-family="JetBrains Mono" font-size="9" text-anchor="middle">L' + v.lapNum + '</text>';
        }).join("");

        container.innerHTML =
            '<svg viewBox="0 0 ' + W + ' ' + H + '" class="block w-full h-auto" role="img" aria-label="Lap time correlation chart">' +
            grid + band + dashes + polyline + dots + lapLabels + '</svg>';

        // Update Insight Text dynamically based on valid lap values
        updateInsightText(validLaps, stressLapObj);
    }

    function updateInsightText(validLaps, stressLapObj) {
        var insightEl = document.getElementById("correlation-insight-text");
        if (!insightEl) return;

        if (validLaps.length === 0) {
            insightEl.textContent = "Enter lap times in section 03 to correlate radio stress events with lap performance.";
            return;
        }

        if (!stressLapObj) {
            if (activeClip.emotion && ["angry", "sad", "fear", "fearful", "disgust"].includes(activeClip.emotion.toLowerCase())) {
                insightEl.textContent = "Driver exhibits a stressed emotion (" + activeClip.emotion + "), but no clear lap time anomaly has been flagged yet.";
            } else {
                insightEl.textContent = "Driver appears calm. Lap times show normal variance.";
            }
            return;
        }

        var nonStressLaps = validLaps.filter(function (v) { return v.index !== stressLapObj.index; });
        if (nonStressLaps.length === 0) {
            insightEl.textContent = "Stress event detected on Lap " + stressLapObj.lapNum + " (" + formatSecondsToLapTime(stressLapObj.sec) + "). Enter more lap times to compute a baseline delta.";
            return;
        }

        var sum = nonStressLaps.reduce(function (acc, item) { return acc + item.sec; }, 0);
        var avg = sum / nonStressLaps.length;
        var delta = stressLapObj.sec - avg;
        var formattedDelta = (delta >= 0 ? "+" : "") + delta.toFixed(3) + "s";

        // F1 specific logic to interpret the time difference
        var interpretation = "";
        if (delta > 1.5) {
            interpretation = "This massive time loss indicates a major incident, such as a severe lockup, running off-track, or extreme traffic.";
        } else if (delta > 0.5) {
            interpretation = "This significant drop in pace suggests a mistake at the apex, oversteer snap, or dirty air from a car ahead.";
        } else if (delta > 0.15) {
            interpretation = "A moderate time loss, likely caused by minor tire degradation, a slight missed braking point, or subtle balance issues.";
        } else if (delta > 0) {
            interpretation = "A marginal time loss. The driver is experiencing stress but maintaining relatively consistent pace.";
        } else {
            interpretation = "Remarkably, the driver set a faster lap despite the stressed radio communication, indicating high adrenaline and pushing the car to the absolute limit.";
        }

        var baseText = "Radio stress event at Lap " + stressLapObj.lapNum + " (" + formatSecondsToLapTime(stressLapObj.sec) +
            ") correlates with a " + formattedDelta + " anomaly compared to stint average (" + formatSecondsToLapTime(avg) + "). ";

        insightEl.textContent = baseText + interpretation;
    }


    /* ---------- LAP INPUT TABLE RENDERER ---------- */
    function renderLapInputsTable() {
        var container = document.getElementById("lap-inputs-list");
        if (!container) return;

        container.innerHTML = "";

        // Calculate best time for delta display
        var validLaps = [];
        lapsData.forEach(function (item, idx) {
            var sec = parseLapTimeToSeconds(item.timeStr);
            if (sec !== null) {
                validLaps.push({ index: idx, lapNum: idx + 1, sec: sec });
            }
        });
        var validSecs = validLaps.map(function (v) { return v.sec; });
        var bestSec = validSecs.length > 0 ? Math.min.apply(null, validSecs) : null;

        var inferredStressLapIdx = getStressLapIndex(validLaps);

        lapsData.forEach(function (lap, idx) {
            var lapNum = idx + 1;
            var secVal = parseLapTimeToSeconds(lap.timeStr);
            var isValid = lap.timeStr.trim() === "" || secVal !== null;
            var isBest = secVal !== null && bestSec !== null && Math.abs(secVal - bestSec) < 0.001;

            var row = document.createElement("div");
            row.className = "lap-input-row " + (!isValid ? "has-error" : "");

            var deltaText = "--";
            if (secVal !== null && bestSec !== null) {
                if (isBest) {
                    deltaText = '<span style="color: var(--cyan-500); font-weight: 600;">BEST LAP</span>';
                } else {
                    var diff = secVal - bestSec;
                    deltaText = '<span style="color: var(--red-500);">+' + diff.toFixed(3) + 's</span>';
                }
            }

            var isStressLap = idx === inferredStressLapIdx;
            var stressBadge = isStressLap ? '<span class="chip chip-red" style="font-size: 8px; padding: 2px 6px; margin-left: 8px;">STRESS EVENT</span>' : '';

            row.innerHTML =
                '<div style="display: flex; align-items: center;">' +
                '<span class="lap-label">LAP ' + (lapNum < 10 ? '0' + lapNum : lapNum) + '</span>' +
                stressBadge +
                '</div>' +
                '<input type="text" class="lap-input-field" value="' + lap.timeStr + '" placeholder="1:23.450" data-idx="' + idx + '">' +
                '<div class="lap-delta-tag">' + deltaText + '</div>' +
                '<button type="button" class="btn-remove-row" title="Remove Lap" data-delete-idx="' + idx + '">' +
                '<span class="material-symbols-outlined" style="font-size: 16px;">close</span>' +
                '</button>';

            container.appendChild(row);
        });

        document.getElementById("lap-counter-text").textContent = lapsData.length + " LAPS RECORDED";

        // Bind input listeners
        container.querySelectorAll(".lap-input-field").forEach(function (input) {
            input.addEventListener("input", function (e) {
                var i = parseInt(e.target.getAttribute("data-idx"), 10);
                lapsData[i].timeStr = e.target.value;
                renderDynamicLapChart();
            });
        });

        // Bind delete listeners
        container.querySelectorAll(".btn-remove-row").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                var btnEl = e.currentTarget;
                var i = parseInt(btnEl.getAttribute("data-delete-idx"), 10);
                lapsData.splice(i, 1);
                renderLapInputsTable();
                renderDynamicLapChart();
            });
        });
    }

    // Public Functions for Lap Table
    window.addLapRow = function () {
        // Appends a new EMPTY lap input field
        lapsData.push({ timeStr: '' });

        renderLapInputsTable();
        renderDynamicLapChart();

        var container = document.getElementById("lap-inputs-list");
        container.scrollTop = container.scrollHeight;
    };

    window.clearAllLaps = function () {
        lapsData = [
            { timeStr: '' },
            { timeStr: '' },
            { timeStr: '' },
            { timeStr: '' }
        ];
        renderLapInputsTable();
        renderDynamicLapChart();
    };

    // Preset Clip Loading & Audio File Handling
    window.loadPresetClip = function (id) {
        if (activeAudio) {
            activeAudio.pause();
            activeAudio = null;
        }
        var playBtn = document.getElementById("play-btn");
        if (playBtn) {
            var panel = playBtn.closest("[data-preview-panel]");
            if (panel) panel.classList.remove("is-playing");
            playBtn.setAttribute("aria-pressed", "false");
            var iconPlay = document.getElementById("icon-play");
            var iconPause = document.getElementById("icon-pause");
            if (iconPlay) iconPlay.style.display = "block";
            if (iconPause) iconPause.style.display = "none";
        }

        if (id === 1) {
            activeClip = {
                name: 'RADIO_CLIP_04_OVERSTEER.WAV',
                durationStr: 'DURATION: 00:12.0',
                stressLapIndex: 3, // Lap 4
                flagText: 'FLAGGED 00:04-00:08',
                calmVal: 'Calm 0.88',
                stressVal: 'Stressed 0.94',
                tiredVal: 'Tired 0.31',
                transcript: [
                    { time: '00:02.4', text: 'DRIVER: wet line on entry, keeping it tidy.', alert: false },
                    { time: '00:06.1', text: 'DRIVER: understeer again, rear is gone, losing time.', alert: true },
                    { time: '00:09.8', text: 'DRIVER: checking delta to car 11.', alert: false }
                ]
            };
        } else if (id === 2) {
            activeClip = {
                name: 'RADIO_TRAFFIC_BRAKES.WAV',
                durationStr: 'DURATION: 00:18.5',
                stressLapIndex: 1, // Lap 2
                flagText: 'FLAGGED 00:06-00:14',
                calmVal: 'Calm 0.62',
                stressVal: 'Stressed 0.82',
                tiredVal: 'Tired 0.45',
                transcript: [
                    { time: '00:03.1', text: 'DRIVER: stuck behind traffic into turn 11.', alert: false },
                    { time: '00:08.4', text: 'DRIVER: brake temps spiking! cannot pass here.', alert: true },
                    { time: '00:15.0', text: 'DRIVER: clear now, pushing on exit.', alert: false }
                ]
            };
        } else if (id === 3) {
            activeClip = {
                name: 'RADIO_CLEAN_PUSH_LAP.WAV',
                durationStr: 'DURATION: 00:14.2',
                stressLapIndex: -1, // No stress
                flagText: 'NO ANOMALIES FLAGGED',
                calmVal: 'Calm 0.96',
                stressVal: 'Stressed 0.12',
                tiredVal: 'Tired 0.20',
                transcript: [
                    { time: '00:02.0', text: 'DRIVER: balance is clean through sector 2.', alert: false },
                    { time: '00:07.5', text: 'DRIVER: hitting apexes nicely, green delta.', alert: false },
                    { time: '00:12.1', text: 'DRIVER: radio silent, focused.', alert: false }
                ]
            };
        }

        // Update DOM elements
        document.getElementById("audio-filename").textContent = activeClip.name;
        document.getElementById("audio-duration").textContent = activeClip.durationStr;
        document.getElementById("audio-status-chip").textContent = activeClip.flagText;
        document.getElementById("audio-status-chip").className = activeClip.stressLapIndex >= 0 ? "chip chip-red" : "chip chip-cyan";

        document.getElementById("chip-calm").textContent = activeClip.calmVal;
        document.getElementById("chip-stress").textContent = activeClip.stressVal;
        document.getElementById("chip-tired").textContent = activeClip.tiredVal;

        var tLines = document.getElementById("transcript-lines");
        tLines.innerHTML = activeClip.transcript.map(function (t) {
            return '<div class="transcript-line">' +
                '<span class="transcript-time">' + t.time + '</span>' +
                '<span class="' + (t.alert ? 'transcript-alert' : 'transcript-normal') + '">' + t.text + '</span>' +
                '</div>';
        }).join("");

        renderLapInputsTable();
        renderDynamicLapChart();
    };

    window.handleAudioFileUpload = function (event) {
        var files = event.target.files;
        if (!files || files.length === 0) return;
        var file = files[0];

        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        audioUrl = URL.createObjectURL(file);
        if (activeAudio) {
            activeAudio.pause();
        }
        activeAudio = new Audio(audioUrl);
        activeAudio.addEventListener('ended', function () {
            var playBtn = document.getElementById("play-btn");
            if (playBtn) {
                var panel = playBtn.closest("[data-preview-panel]");
                if (panel) panel.classList.remove("is-playing");
                playBtn.setAttribute("aria-pressed", "false");
                var iconPlay = document.getElementById("icon-play");
                var iconPause = document.getElementById("icon-pause");
                if (iconPlay) iconPlay.style.display = "block";
                if (iconPause) iconPause.style.display = "none";
            }
        });

        // Update UI to show uploading state
        document.getElementById("audio-filename").textContent = "Uploading " + file.name + "...";
        document.getElementById("audio-status-chip").textContent = "ANALYZING...";
        document.getElementById("audio-status-chip").className = "chip chip-neutral";

        var formData = new FormData();
        formData.append('audio', file); // multer in index.js expects 'audio'

        fetch('/upload-audio', {
            method: 'POST',
            body: formData
        })
            .then(function (res) {
                return res.json();
            })
            .then(function (data) {
                console.log("ML Response:", data);

                if (data.error || data.success === false) {
                    console.error("Backend returned error:", data);
                    document.getElementById("audio-filename").textContent = "ERROR: " + (data.error || "Upload Failed");
                    document.getElementById("audio-status-chip").textContent = "UPLOAD FAILED";
                    document.getElementById("audio-status-chip").className = "chip chip-red";
                    return;
                }

                // Map the API response (emotion, confidence) to the UI
                document.getElementById("audio-filename").textContent = file.name;
                var rawEmotion = data.emotion ? data.emotion.toLowerCase() : "unknown";
                activeClip.emotion = rawEmotion; // Store for chart inference

                var mappedEmotion = "UNKNOWN";
                var isStressed = false;

                if (["angry", "sad", "fear", "fearful"].includes(rawEmotion)) {
                    mappedEmotion = "STRESSED";
                    isStressed = true;
                } else if (rawEmotion === "disgust") {
                    mappedEmotion = "TIRED";
                    isStressed = true;
                } else if (["neutral", "calm", "happy"].includes(rawEmotion)) {
                    mappedEmotion = "CALM";
                    isStressed = false;
                } else {
                    mappedEmotion = rawEmotion.toUpperCase();
                }

                document.getElementById("audio-duration").textContent = "DETECTED EMOTION: " + mappedEmotion;

                document.getElementById("audio-status-chip").textContent = "EMOTION: " + mappedEmotion;
                document.getElementById("audio-status-chip").className = isStressed ? "chip chip-red" : "chip chip-cyan";

                document.getElementById("chip-calm").textContent = "Confidence: " + (data.confidence ? (data.confidence * 100).toFixed(1) + "%" : "--");
                document.getElementById("chip-stress").textContent = "Status: " + (data.success ? "Success" : "Failed");
                document.getElementById("chip-tired").textContent = "--";

                var tLines = document.getElementById("transcript-lines");
                var displayTranscript = data.transcript || ("Analysis complete. Detected emotion: " + (data.emotion || "unknown"));
                tLines.innerHTML = '<div class="transcript-line">' +
                    '<span class="transcript-time">System</span>' +
                    '<span class="transcript-normal">' + displayTranscript + '</span>' +
                    '</div>';

                renderLapInputsTable();
                renderDynamicLapChart();
            })
            .catch(function (err) {
                console.error("Upload failed:", err);
                document.getElementById("audio-filename").textContent = "ERROR UPLOADING";
                document.getElementById("audio-status-chip").textContent = "UPLOAD FAILED";
                document.getElementById("audio-status-chip").className = "chip chip-red";
            });
    };

    /* ---------- AUDIO PLAY BUTTON TOGGLE ---------- */
    function setupPlayButton() {
        var playBtn = document.getElementById("play-btn");
        if (!playBtn) return;

        playBtn.addEventListener("click", function () {
            if (!activeAudio) {
                alert("Please upload an audio file first to play it.");
                return;
            }

            var panel = playBtn.closest("[data-preview-panel]");
            var playing = false;
            if (panel) playing = panel.classList.toggle("is-playing");
            else playing = playBtn.getAttribute("aria-pressed") !== "true";

            playBtn.setAttribute("aria-pressed", playing ? "true" : "false");

            var iconPlay = document.getElementById("icon-play");
            var iconPause = document.getElementById("icon-pause");
            if (iconPlay) iconPlay.style.display = playing ? "none" : "block";
            if (iconPause) iconPause.style.display = playing ? "block" : "none";

            if (playing) {
                activeAudio.play().catch(function (e) { console.error("Playback failed", e); });
            } else {
                activeAudio.pause();
            }
        });
    }

    /* ---------- INITIALIZATION ---------- */
    document.addEventListener("DOMContentLoaded", function () {
        renderLapInputsTable();
        renderDynamicLapChart();
        setupPlayButton();
    });

})();