const shortId = Math.floor(1000 + Math.random() * 9000).toString();
const peer = new Peer(shortId); 
let conn;

const status = document.getElementById('status');
const sendBtn = document.getElementById('sendBtn');
const receiveBtn = document.getElementById('receiveBtn');
const fileInput = document.getElementById('fileInput');
const visualizer = document.getElementById('visualizer');
const ctx = visualizer.getContext('2d');

// --- 1. Peer Setup ---
peer.on('open', (id) => {
    status.innerText = "Your Sonic ID: " + id;
});

// --- 2. The Whistle (Sender) ---
async function whistleId(id) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    let time = audioCtx.currentTime;
    // Add a 'Start' tone (16kHz) so the receiver knows a message is coming
    playTone(16000, time, 0.3, audioCtx);
    time += 0.4;

    id.split('').forEach(digit => {
        const freq = 17000 + (parseInt(digit) * 200); 
        playTone(freq, time, 0.2, audioCtx);
        time += 0.3; 
    });
    status.innerText = "Broadcasting Sonic ID...";
}

function playTone(freq, startTime, duration, ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
}

// --- 3. The Decoder (Receiver) ---
let detectedDigits = "";
let lastDetectionTime = 0;

async function startListening() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 4096; // Higher resolution for accuracy
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function decode() {
        analyser.getByteFrequencyData(dataArray);
        const now = Date.now();

        // Visualizer
        ctx.clearRect(0, 0, visualizer.width, visualizer.height);
        ctx.fillStyle = '#38bdf8';
        for (let i = 0; i < 200; i++) {
            ctx.fillRect(i * 3, visualizer.height - dataArray[i + 1000] / 2, 2, dataArray[i + 1000] / 2);
        }

        // Search for digits (17000Hz to 18800Hz)
        if (now - lastDetectionTime > 250) { 
            for (let digit = 0; digit <= 9; digit++) {
                const targetFreq = 17000 + (digit * 200);
                const bin = Math.round(targetFreq / (audioCtx.sampleRate / analyser.fftSize));
                
                if (dataArray[bin] > 180) { // Threshold for detection
                    detectedDigits += digit;
                    lastDetectionTime = now;
                    status.innerText = "Hearing: " + detectedDigits;
                    
                    if (detectedDigits.length === 4) {
                        autoConnect(detectedDigits);
                        detectedDigits = ""; // Reset
                    }
                    break;
                }
            }
        }
        requestAnimationFrame(decode);
    }
    decode();
}

function autoConnect(targetId) {
    status.innerText = "Auto-Connecting to " + targetId + "...";
    conn = peer.connect(targetId);
    setupConnection();
}

// --- 4. Connection Logic ---
sendBtn.onclick = () => {
    const file = fileInput.files[0];
    if (!file) return alert("Select a file!");
    whistleId(peer.id);
};

receiveBtn.onclick = () => {
    startListening();
    status.innerText = "Listening for Sonic ID...";
};

peer.on('connection', (connection) => {
    conn = connection;
    setupConnection();
});

function setupConnection() {
    conn.on('open', () => {
        status.innerText = "Link Established!";
        const file = fileInput.files[0];
        if (file) {
            conn.send({ fileData: file, fileName: file.name, fileType: file.type });
        }
    });

    conn.on('data', (data) => {
        if (data.fileData) {
            const blob = new Blob([data.fileData], { type: data.fileType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.fileName;
            a.click();
            status.innerText = "Received: " + data.fileName;
        }
    });
}