// 1. VARIABLES & INITIALIZATION
const shortId = Math.floor(1000 + Math.random() * 9000).toString();
const peer = new Peer(shortId); 
let conn;

const status = document.getElementById('status');
const fileInput = document.getElementById('fileInput');
const realSendBtn = document.getElementById('realSendBtn');
const previewCard = document.getElementById('file-preview-card');
const previewName = document.getElementById('preview-name');
const previewSize = document.getElementById('preview-size');

// 2. PEER STATUS
peer.on('open', (id) => {
    status.innerText = "Your ID: " + id;
    console.log("PeerID generated: " + id);
});

// 3. FILE SELECTION LOGIC
fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (file) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        
        // Visual feedback that file is chosen
        previewCard.style.display = 'block';
        previewName.innerText = "📄 " + file.name;
        previewSize.innerText = sizeMB + " MB";
        status.innerText = "File Attached & Ready";
    }
};

// 4. WHISTLE LOGIC
async function whistleId(id) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    let time = audioCtx.currentTime;

    id.split('').forEach(digit => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const freq = 17000 + (parseInt(digit) * 200); 
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
        gain.gain.linearRampToValueAtTime(0, time + 0.25);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(time); 
        osc.stop(time + 0.3);
        time += 0.3; 
    });
}

// 5. THE SEND BUTTON ACTION
realSendBtn.onclick = () => {
    const file = fileInput.files[0];

    // Check if file exists - Your requested popup
    if (!file) {
        alert("Wait! You didn't choose a file. Please click 'Browse File' first.");
        return; 
    }

    // Trigger Whistle
    whistleId(peer.id);
    
    // Connect via Manual Code
    const targetId = prompt("Enter the Receiver's 4-digit ID:");
    if (targetId) {
        status.innerText = "Connecting to " + targetId + "...";
        conn = peer.connect(targetId);
        setupConnection(file); 
    }
};

// 6. RECEIVE BUTTON
document.getElementById('receiveBtn').onclick = () => {
    status.innerText = "Waiting for incoming connection...";
};

// Handle Incoming Connection
peer.on('connection', (connection) => {
    conn = connection;
    setupConnection();
});

// 7. DATA TRANSFER LOGIC
function setupConnection(fileToSend = null) {
    conn.on('open', async () => {
        status.innerText = "Connected!";
        
        if (fileToSend) {
            status.innerText = "Sending raw data...";
            // Stripping metadata by sending ArrayBuffer
            const buffer = await fileToSend.arrayBuffer();
            conn.send({
                fileData: buffer,
                fileName: fileToSend.name,
                fileType: fileToSend.type,
                fileSize: (fileToSend.size / (1024 * 1024)).toFixed(2)
            });
            setTimeout(() => { status.innerText = "Transfer Successful!"; }, 2000);
        }
    });

    conn.on('data', (data) => {
        if (data.fileData) {
            status.innerText = `Received: ${data.fileName} (${data.fileSize} MB)`;
            const blob = new Blob([data.fileData], { type: data.fileType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.fileName;
            a.click();
        }
    });
}