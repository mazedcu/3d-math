const panLeft = document.getElementById('pan-left');
const panRight = document.getElementById('pan-right');
const beam = document.getElementById('beam');
const eqText = document.getElementById('eq-text');
const xIn = document.getElementById('x-in');
const btnSubmit = document.getElementById('btn-submit');
const scoreEl = document.getElementById('score');

let score = 0;
let targetX = 0;
let eqA = 0;
let eqB = 0;
let eqC = 0;

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

function playSuccess() {
    playTone(400, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(600, 'sine', 0.1, 0.1), 100);
    setTimeout(() => playTone(800, 'sine', 0.3, 0.1), 200);
}

function playCreak() {
    playTone(150, 'sawtooth', 0.3, 0.1);
}

function generateRound() {
    beam.style.transform = `rotate(10deg)`; // Starts unbalanced
    panLeft.style.transform = `rotate(-10deg)`;
    panRight.style.transform = `rotate(-10deg)`;
    xIn.value = '';
    
    // Eq: A*X + B = C
    targetX = Math.floor(Math.random() * 5) + 1; // 1 to 5
    eqA = Math.floor(Math.random() * 3) + 1; // 1 to 3
    eqB = Math.floor(Math.random() * 5) + 1; // 1 to 5
    eqC = eqA * targetX + eqB;
    
    eqText.innerText = `${eqA}X + ${eqB} = ${eqC}`;
    
    // Build left pan
    panLeft.innerHTML = '';
    for(let i=0; i<eqA; i++) {
        let b = document.createElement('div');
        b.className = 'block-x';
        b.innerText = 'X';
        panLeft.appendChild(b);
    }
    for(let i=0; i<eqB; i++) {
        let b = document.createElement('div');
        b.className = 'block-1';
        b.innerText = '1';
        panLeft.appendChild(b);
    }
    
    // Build right pan
    panRight.innerHTML = '';
    for(let i=0; i<eqC; i++) {
        let b = document.createElement('div');
        b.className = 'block-1';
        b.innerText = '1';
        panRight.appendChild(b);
    }
}

btnSubmit.addEventListener('click', () => {
    let guess = parseInt(xIn.value);
    if (isNaN(guess)) return;
    
    let leftWeight = eqA * guess + eqB;
    let rightWeight = eqC;
    
    if (leftWeight === rightWeight) {
        // Balance
        beam.style.transform = `rotate(0deg)`;
        panLeft.style.transform = `rotate(0deg)`;
        panRight.style.transform = `rotate(0deg)`;
        playSuccess();
        score += 10;
        scoreEl.innerText = score;
        setTimeout(generateRound, 2000);
    } else {
        // Unbalance
        let deg = leftWeight > rightWeight ? -15 : 15;
        beam.style.transform = `rotate(${deg}deg)`;
        panLeft.style.transform = `rotate(${-deg}deg)`;
        panRight.style.transform = `rotate(${-deg}deg)`;
        playCreak();
        score = Math.max(0, score - 5);
        scoreEl.innerText = score;
    }
});

generateRound();
