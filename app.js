const peer = new Peer(); // Initialize PeerJS
let conn;

peer.on('open', (id) => {
    console.log('My ID is: ' + id);
    // This ID is what we will convert to sound!
});

// Handle incoming data
peer.on('connection', (connection) => {
    conn = connection;
    setupDataListeners();
});

const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');

sendBtn.onclick = () => fileInput.click();

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    // 1. Play the "Ultrasonic ID" (The sound handshake)
    playIdAsSound(peer.id); 
    
    document.getElementById('status').innerText = "Broadcasting Sound...";
};


const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');

sendBtn.onclick = () => fileInput.click();

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    // 1. Play the "Ultrasonic ID" (The sound handshake)
    playIdAsSound(peer.id); 
    
    document.getElementById('status').innerText = "Broadcasting Sound...";
};

function playIdAsSound(id) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(18000, ctx.currentTime); // 18kHz - Silent to most humans

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    // Logic to modulate frequency based on ID string goes here
    osc.stop(ctx.currentTime + 2); // Play for 2 seconds
}
const receiveBtn = document.getElementById('receiveBtn');

receiveBtn.onclick = async () => {
    document.getElementById('status').innerText = "Listening for sound signal...";
    
    // 1. Get Microphone Access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    
    analyser.fftSize = 2048; // High resolution for detecting high pitches
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // 2. Scan for the 18kHz Peak
    function detect() {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate which 'bin' (index) corresponds to 18000Hz
        const nyquist = audioCtx.sampleRate / 2;
        const targetBin = Math.round((18000 / nyquist) * bufferLength);
        
        // If the volume at that 18kHz bin is high, we've found our signal!
        if (dataArray[targetBin] > 200) { 
            console.log("Signal Detected! Connecting...");
            document.getElementById('status').innerText = "Signal Caught! Linking...";
            
            // In a real app, you'd decode the full ID here. 
            // For now, let's assume we use a 'public room' or a static ID.
            connectToPeer('target-id-from-sound');
            return; // Stop listening once connected
        }
        requestAnimationFrame(detect);
    }
    detect();
};
function setupDataListeners() {
    conn.on('data', (data) => {
        // 'data' is the file! Convert it back to a blob and download.
        const blob = new Blob([data]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "received_file";
        a.click();
        document.getElementById('status').innerText = "File Received!";
    });
}

function sendFile(file) {
    conn.send(file);
    document.getElementById('status').innerText = "File Sent Successfully!";
}
async function transmitId(peerId) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const bitDuration = 0.2; // Each bit lasts 0.2 seconds
    
    // Convert string ID to binary (8 bits per character)
    const binary = peerId.split('').map(char => 
        char.charCodeAt(0).toString(2).padStart(8, '0')
    ).join('');

    let currentTime = audioCtx.currentTime;

    binary.split('').forEach(bit => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        // Frequency: 18.5kHz for '0', 19.5kHz for '1'
        const freq = (bit === '1') ? 19500 : 18500;
        
        osc.frequency.setValueAtTime(freq, currentTime);
        osc.type = 'sine';
        
        // Simple Volume Envelope to prevent "clicking" sounds
        gain.gain.setValueAtTime(0, currentTime);
        gain.gain.linearRampToValueAtTime(0.5, currentTime + 0.01);
        gain.gain.linearRampToValueAtTime(0, currentTime + bitDuration - 0.01);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(currentTime);
        osc.stop(currentTime + bitDuration);
        
        currentTime += bitDuration;
    });
}
function startListening() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048; // Higher = more precise frequency detection
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const sampleRate = audioCtx.sampleRate;

        function checkFrequency() {
            analyser.getByteFrequencyData(dataArray);
            
            // Map frequencies to indices in the dataArray
            const idx0 = Math.round(18500 / (sampleRate / analyser.fftSize));
            const idx1 = Math.round(19500 / (sampleRate / analyser.fftSize));

            const vol0 = dataArray[idx0];
            const vol1 = dataArray[idx1];

            if (vol1 > 150 && vol1 > vol0) {
                console.log("Heard a 1!"); // You'd collect these bits into a string
            } else if (vol0 > 150 && vol0 > vol1) {
                console.log("Heard a 0!");
            }
            
            requestAnimationFrame(checkFrequency);
        }
        checkFrequency();
    });
}

async function sendSonicHandshake(peerId) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const bitDuration = 0.15; // Speed: 150ms per bit
    
    // Add Start and End markers (Frequency 18kHz)
    const dataToTransmit = [18000, ...stringToFreqs(peerId), 18000];

    let time = audioCtx.currentTime;
    dataToTransmit.forEach(freq => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.frequency.setValueAtTime(freq, time);
        
        // Preventing clicks with a tiny fade-in/out
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.01);
        gain.gain.linearRampToValueAtTime(0, time + bitDuration - 0.01);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + bitDuration);
        time += bitDuration;
    });
}

function stringToFreqs(str) {
    // Converts "ABC" -> Binary -> [19000, 20000, ...]
    return str.split('').flatMap(char => 
        char.charCodeAt(0).toString(2).padStart(8, '0').split('')
            .map(bit => bit === '1' ? 20000 : 19000)
    );
}

let isRecording = false;
let bitsCollected = [];

function monitorAudio() {
    // ... inside your detect loop ...
    const volStart = dataArray[getBin(18000)];
    const vol0 = dataArray[getBin(19000)];
    const vol1 = dataArray[getBin(20000)];

    if (volStart > 200 && !isRecording) {
        isRecording = true; // Start signal detected!
        bitsCollected = [];
    } else if (isRecording) {
        if (volStart > 200 && bitsCollected.length > 5) {
            isRecording = false; // Stop signal detected!
            const finalId = decodeBits(bitsCollected);
            peer.connect(finalId);
        } else {
            // Logic to sample bits at fixed intervals
            if (vol1 > vol0) bitsCollected.push(1);
            else if (vol0 > vol1) bitsCollected.push(0);
        }
    }
}

let isRecording = false;
let bitsCollected = [];

function monitorAudio() {
    // ... inside your detect loop ...
    const volStart = dataArray[getBin(18000)];
    const vol0 = dataArray[getBin(19000)];
    const vol1 = dataArray[getBin(20000)];

    if (volStart > 200 && !isRecording) {
        isRecording = true; // Start signal detected!
        bitsCollected = [];
    } else if (isRecording) {
        if (volStart > 200 && bitsCollected.length > 5) {
            isRecording = false; // Stop signal detected!
            const finalId = decodeBits(bitsCollected);
            peer.connect(finalId);
        } else {
            // Logic to sample bits at fixed intervals
            if (vol1 > vol0) bitsCollected.push(1);
            else if (vol0 > vol1) bitsCollected.push(0);
        }
    }
}

// Add this inside your detect() loop
let volBuffer0 = [];
let volBuffer1 = [];

function getAverage(buffer) {
    return buffer.reduce((a, b) => a + b, 0) / buffer.length;
}

// In the loop:
volBuffer0.push(dataArray[getBin(FREQ_0)]);
volBuffer1.push(dataArray[getBin(FREQ_1)]);

if (volBuffer0.length > 5) {
    volBuffer0.shift(); // Keep only the last 5 samples
    volBuffer1.shift();
}

const avg0 = getAverage(volBuffer0);
const avg1 = getAverage(volBuffer1);
// Now use avg0 and avg1 to decide if the bit is 0 or 1

// Function to generate a simple checksum
function createChecksum(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data.charCodeAt(i);
    }
    return (sum % 256).toString(16).padStart(2, '0'); // Returns a 2-character hex code
}

// Update your transmission string:
const peerIdWithChecksum = peerId + "-" + createChecksum(peerId);
// Transmit THIS string instead of just the peerId

let bitHistory = []; // Stores the last few bits detected

function decodeFinalBits(bits) {
    // 1. Group the raw bits into 8-bit chunks (bytes)
    // 2. Convert bytes back to characters
    // 3. Split the result by the "-"
    // 4. Recalculate the checksum and compare!
    
    if (recalculatedChecksum === receivedChecksum) {
        console.log("Success! Connecting to:", originalId);
        peer.connect(originalId);
    } else {
        status.innerText = "Error: Signal Corrupted. Try again.";
    }
}

