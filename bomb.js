const eqDisplay = document.getElementById('equation');
const wiresArea = document.getElementById('wires');
const scoreEl = document.getElementById('score');
const explosion = document.getElementById('explosion');

let score = 0;

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playTone(freq, type, duration, vol=0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playSnip() {
    playTone(1200, 'triangle', 0.1, 0.1);
}

function playBoom() {
    const bufferSize = audioCtx.sampleRate * 1.0;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 1);
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
    
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    noiseSource.start();
}

function playSuccess() {
    playTone(400, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(600, 'sine', 0.1, 0.1), 100);
    setTimeout(() => playTone(800, 'sine', 0.3, 0.1), 200);
}

// Generate an expression like "A + B * C"
function generateRound() {
    wiresArea.innerHTML = '';
    
    let a = Math.floor(Math.random() * 10) + 1;
    let b = Math.floor(Math.random() * 10) + 1;
    let c = Math.floor(Math.random() * 10) + 1;
    
    let types = [
        { eq: `${a} + ${b} × ${c}`, ops: ['+', '×'], correctIndex: 1 },
        { eq: `${a} × ${b} + ${c}`, ops: ['×', '+'], correctIndex: 0 },
        { eq: `${a} - ${b} × ${c}`, ops: ['-', '×'], correctIndex: 1 },
        { eq: `${a} + ${b} ÷ ${c}`, ops: ['+', '÷'], correctIndex: 1 }, // ensure c divides b cleanly? no just label wires
    ];
    
    // For div, ensure clean division
    let typesDiv = [
        { eq: `${a} + ${b*c} ÷ ${c}`, ops: ['+', '÷'], correctIndex: 1 },
        { eq: `${b*c} ÷ ${c} - ${a}`, ops: ['÷', '-'], correctIndex: 0 }
    ];
    
    let allTypes = types.concat(typesDiv);
    let roundData = allTypes[Math.floor(Math.random() * allTypes.length)];
    
    eqDisplay.innerText = roundData.eq;
    
    let colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
    colors.sort(() => Math.random() - 0.5);
    
    roundData.ops.forEach((op, index) => {
        let btn = document.createElement('div');
        btn.className = 'wire-btn';
        btn.innerHTML = `
            <svg class="wire-svg" viewBox="0 0 60 150">
                <path d="M30,0 C30,50 10,100 30,150" stroke="${colors[index]}" stroke-width="12" fill="none" class="wire-path"/>
            </svg>
            <div class="wire-label">${op}</div>
        `;
        
        btn.onclick = () => {
            playSnip();
            btn.querySelector('.wire-path').classList.add('cut-anim');
            
            if (index === roundData.correctIndex) {
                // Correct
                playSuccess();
                score += 10;
                scoreEl.innerText = score;
                setTimeout(generateRound, 1000);
            } else {
                // Boom
                playBoom();
                explosion.classList.add('boom');
                score = Math.max(0, score - 5);
                scoreEl.innerText = score;
                setTimeout(() => {
                    explosion.classList.remove('boom');
                    generateRound();
                }, 1000);
            }
        };
        
        wiresArea.appendChild(btn);
    });
}

generateRound();
