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