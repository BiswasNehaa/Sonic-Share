// 1. IDENTITY - Generate the random 4-digit "Phone Number"
const shortId = Math.floor(1000 + Math.random() * 9000).toString();
const peer = new Peer(shortId); 
let conn;

// UI Elements
const status = document.getElementById('status');
const sendBtn = document.getElementById('sendBtn');
const receiveBtn = document.getElementById('receiveBtn');
const fileInput = document.getElementById('fileInput');
const visualizer = document.getElementById('visualizer');
const ctx = visualizer.getContext('2d');

// 2. PEER SETUP
peer.on('open', (id) => {
    status.innerText = "Your Sonic ID: " + id;
});

// 3. THE WHISTLE (Sender side)
async function whistleId(id) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    let time = audioCtx.currentTime;
    
    // Start Tone (16kHz) to wake up the receiver
    playTone(16000, time, 0.1, audioCtx);
    time += 0.15;

    // Whistle the 4 digits rapidly
    id.split('').forEach(digit => {
        const freq = 17000 + (parseInt(digit) * 200); 
        playTone(freq, time, 0.1, audioCtx); 
        time += 0.15; 
    });
    status.innerText = "Broadcasting ID...";
}

function playTone(freq, startTime, duration, ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
}

// 4. THE DECODER (Receiver side)
let detectedDigits = "";
let lastDetectionTime = 0;

async function startListening() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 4096; 
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function decode() {
        analyser.getByteFrequencyData(dataArray);
        const now = Date.now();

        // High-speed Visualizer
        ctx.clearRect(0, 0, visualizer.width, visualizer.height);
        ctx.fillStyle = '#38bdf8';
        for (let i = 0; i < 200; i++) {
            // Focus visualizer on the high-frequency range
            ctx.fillRect(i * 3, visualizer.height - dataArray[i + 1400] / 2, 2, dataArray[i + 1400] / 2);
        }

        // Logic to hear the ID
        if (now - lastDetectionTime > 120) { 
            for (let digit = 0; digit <= 9; digit++) {
                const targetFreq = 17000 + (digit * 200);
                const bin = Math.round(targetFreq / (audioCtx.sampleRate / analyser.fftSize));
                
                if (dataArray[bin] > 100) { // SENSITIVE THRESHOLD
                    detectedDigits += digit;
                    lastDetectionTime = now;
                    status.innerText = "Hearing: " + detectedDigits;
                    
                    if (detectedDigits.length === 4) {
                        connectToDevice(detectedDigits);
                        detectedDigits = ""; 
                    }
                    break;
                }
            }
        }
        requestAnimationFrame(decode);
    }
    decode();
}

// 5. CONNECTION & DATA HANDLING
function connectToDevice(targetId) {
    status.innerText = "Connecting to " + targetId + "...";
    conn = peer.connect(targetId);
    setupConnection();
}

peer.on('connection', (connection) => {
    conn = connection;
    setupConnection();
});

function setupConnection() {
    conn.on('open', () => {
        status.innerText = "Link Established!";
        // Auto-send if a file is already picked
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

// 6. BUTTON ACTIONS
sendBtn.onclick = () => {
    if (!fileInput.files[0]) return alert("Please select a file first!");
    whistleId(peer.id);
};

receiveBtn.onclick = () => {
    startListening();
    status.innerText = "Listening for Sonic ID...";
};