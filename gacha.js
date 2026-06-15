const globe = document.getElementById('globe');
const knob = document.getElementById('knob');
const prizeBall = document.getElementById('prize-ball');
const numIn = document.getElementById('num-in');
const denIn = document.getElementById('den-in');
const btnSubmit = document.getElementById('btn-submit');
const promptEl = document.getElementById('prompt');
const scoreEl = document.getElementById('score');

let score = 0;
let targetColor = '';
let targetCount = 0;
let totalCount = 0;

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

function playCrank() {
    playTone(200, 'square', 0.1, 0.1);
    setTimeout(() => playTone(250, 'square', 0.1, 0.1), 100);
    setTimeout(() => playTone(300, 'square', 0.1, 0.1), 200);
}

function playSuccess() {
    playTone(400, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(600, 'sine', 0.1, 0.1), 100);
    setTimeout(() => playTone(800, 'sine', 0.3, 0.1), 200);
}

function playError() {
    playTone(150, 'sawtooth', 0.3, 0.1);
}

const colors = [
    { name: 'RED', hex: '#ef4444' },
    { name: 'BLUE', hex: '#3b82f6' },
    { name: 'GREEN', hex: '#10b981' },
    { name: 'YELLOW', hex: '#eab308' }
];

function generateRound() {
    globe.innerHTML = '';
    prizeBall.classList.remove('prize-anim');
    prizeBall.style.opacity = 0;
    numIn.value = '';
    denIn.value = '';
    
    totalCount = Math.floor(Math.random() * 10) + 8; // 8 to 17 balls
    let counts = { RED:0, BLUE:0, GREEN:0, YELLOW:0 };
    
    for(let i=0; i<totalCount; i++) {
        let color = colors[Math.floor(Math.random() * colors.length)];
        counts[color.name]++;
        
        let ball = document.createElement('div');
        ball.className = 'ball';
        ball.style.background = color.hex;
        globe.appendChild(ball);
    }
    
    // Pick a target color that exists
    let existingColors = Object.keys(counts).filter(k => counts[k] > 0);
    targetColor = existingColors[Math.floor(Math.random() * existingColors.length)];
    targetCount = counts[targetColor];
    
    promptEl.innerHTML = `What is the probability of getting a <span style="color:${colors.find(c=>c.name===targetColor).hex}; font-weight:bold;">${targetColor}</span> monster?`;
}

function checkAnswer() {
    let n = parseInt(numIn.value);
    let d = parseInt(denIn.value);
    
    if (isNaN(n) || isNaN(d) || d === 0) {
        document.body.classList.add('flash-red');
        setTimeout(() => document.body.classList.remove('flash-red'), 300);
        return;
    }
    
    if (n * totalCount === d * targetCount) {
        // Correct
        playCrank();
        knob.style.transform = 'rotate(90deg)';
        setTimeout(() => knob.style.transform = 'rotate(0deg)', 300);
        
        // Show prize
        setTimeout(() => {
            prizeBall.style.background = colors.find(c=>c.name===targetColor).hex;
            prizeBall.classList.add('prize-anim');
            playSuccess();
            score += 10;
            scoreEl.innerText = score;
            
            setTimeout(generateRound, 2000);
        }, 300);
    } else {
        // Wrong
        playError();
        document.body.classList.add('flash-red');
        setTimeout(() => document.body.classList.remove('flash-red'), 500);
        score = Math.max(0, score - 5);
        scoreEl.innerText = score;
    }
}

btnSubmit.addEventListener('click', checkAnswer);
knob.addEventListener('click', checkAnswer);

[numIn, denIn].forEach(input => {
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
});

generateRound();
