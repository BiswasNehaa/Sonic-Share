// 1. VARIABLES - Keeping track of everything
const shortId = Math.floor(1000 + Math.random() * 9000).toString();
const peer = new Peer(shortId); 
let conn;
let receivedChunks = [];

// UI Elements
const status = document.getElementById('status');
const sendBtn = document.getElementById('sendBtn');
const receiveBtn = document.getElementById('receiveBtn');
const fileInput = document.getElementById('fileInput');
const visualizer = document.getElementById('visualizer');
const ctx = visualizer.getContext('2d');

// 2. PEER SETUP
peer.on('open', (id) => {
    status.innerText = "Your ID: " + id;
    console.log("My ID is: " + id);
});

// 3. SOUND GENERATOR - The "Whistle"
async function whistleId(id) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let time = audioCtx.currentTime;

    // Convert the 4-digit ID into 4 distinct tones
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
    
    status.innerText = "Whistling ID: " + id;
}

// 4. THE EAR - Listening for the Whistle
async function startListening() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function render() {
        analyser.getByteFrequencyData(dataArray);
        
        ctx.clearRect(0, 0, visualizer.width, visualizer.height);
        for (let i = 0; i < dataArray.length; i++) {
            ctx.fillStyle = `rgb(56, 189, 248)`;
            ctx.fillRect(i * 2, visualizer.height - dataArray[i]/2, 1, dataArray[i]/2);
        }

        const targetBin = Math.round(18000 / (audioCtx.sampleRate / analyser.fftSize));
        if (dataArray[targetBin] > 150) {
            status.innerText = "Sound Detected!";
        }
        requestAnimationFrame(render);
    }
    render();
}

// 5. SENDING THE FILE
sendBtn.onclick = () => {
    const file = fileInput.files[0];
    if (!file) return alert("Please select a file first!");
    
    whistleId(peer.id); 
    
    const targetId = prompt("Enter the Receiver's 4-digit ID:");
    
    if (targetId) {
        status.innerText = "Connecting...";
        conn = peer.connect(targetId);
        
        conn.on('open', () => {
            status.innerText = "Sending: " + file.name;
            
            conn.send({
                fileData: file,
                fileName: file.name,
                fileType: file.type
            });

            setTimeout(() => {
                status.innerText = "File Sent Successfully!";
            }, 2000);
        });
    }
};

// 6. RECEIVING THE FILE
receiveBtn.onclick = () => {
    startListening();
};

peer.on('connection', (connection) => {
    conn = connection;
    status.innerText = "Connected!";

    conn.on('data', (data) => {
        if (data.fileData) {
            status.innerText = "Receiving: " + data.fileName;
            
            const blob = new Blob([data.fileData], { type: data.fileType });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = data.fileName; 
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            status.innerText = "File Received!";
        }
    });
});