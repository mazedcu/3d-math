const liquid = document.getElementById('liquid');
const targetLine = document.getElementById('target-line');
const targetLabel = document.getElementById('target-label');
const currentVal = document.getElementById('current-val');
const btnCheck = document.getElementById('btn-check');
const scoreEl = document.getElementById('score');

let targetAmt = 0;
let currentAmt = 0;
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

function playPour() {
    playTone(300 + currentAmt*200, 'sine', 0.2, 0.1);
}

function playSuccess() {
    playTone(400, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(600, 'sine', 0.1, 0.1), 100);
    setTimeout(() => playTone(800, 'sine', 0.3, 0.1), 200);
}

function playError() {
    playTone(150, 'sawtooth', 0.3, 0.1);
}

function generateRound() {
    // Generate target: multiples of 0.05 between 0.30 and 1.80
    targetAmt = Math.floor(Math.random() * 30 + 6) * 0.05;
    // Fix precision
    targetAmt = Math.round(targetAmt * 100) / 100;
    
    currentAmt = 0;
    updateDisplay();
    
    targetLabel.innerText = targetAmt.toFixed(2) + 'L';
    
    // Max is 2.0L = 100% height
    let targetPercent = (targetAmt / 2.0) * 100;
    targetLine.style.bottom = `${targetPercent}%`;
}

function pour(amt) {
    currentAmt += amt;
    currentAmt = Math.round(currentAmt * 100) / 100;
    if (currentAmt > 2.0) currentAmt = 2.0;
    
    playPour();
    updateDisplay();
}

// Attach pour globally for inline onclick
window.pour = pour;

function updateDisplay() {
    currentVal.innerText = currentAmt.toFixed(2);
    let percent = (currentAmt / 2.0) * 100;
    liquid.style.height = `${percent}%`;
}

btnCheck.addEventListener('click', () => {
    if (currentAmt === targetAmt) {
        playSuccess();
        score += 10;
        scoreEl.innerText = score;
        // Flash liquid green
        liquid.style.background = '#10b981';
        setTimeout(() => {
            liquid.style.background = '#06b6d4';
            generateRound();
        }, 1500);
    } else {
        playError();
        score = Math.max(0, score - 5);
        scoreEl.innerText = score;
        // Flash liquid red
        liquid.style.background = '#ef4444';
        setTimeout(() => {
            liquid.style.background = '#06b6d4';
            currentAmt = 0; // reset
            updateDisplay();
        }, 1000);
    }
});

generateRound();
