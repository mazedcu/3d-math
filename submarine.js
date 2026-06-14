const qText = document.getElementById('question-text');
const answersGrid = document.getElementById('answers');
const sub = document.getElementById('submarine');
const bubble = document.getElementById('bubble');
const scoreEl = document.getElementById('score');
const overlay = document.getElementById('announcement-overlay');
const btnStart = document.getElementById('btn-start');

let currentDepth = -50;
let score = 0;
let correctAnswer = 0;

// Audio setup
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

function playBubble() {
    playTone(300, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(400, 'sine', 0.1, 0.1), 100);
    setTimeout(() => playTone(500, 'sine', 0.1, 0.1), 200);
}

function playAlarm() {
    playTone(200, 'sawtooth', 0.2, 0.2);
    setTimeout(() => playTone(150, 'sawtooth', 0.3, 0.2), 200);
}

function generateRound() {
    let change = Math.floor(Math.random() * 8 + 2) * 10; // 20 to 100
    let isDrop = Math.random() > 0.5;
    
    // Prevent going above water (positive) or too deep (< -800)
    if (currentDepth + change > 0) isDrop = true;
    if (currentDepth - change < -800) isDrop = false;
    
    if (isDrop) {
        qText.innerText = `Currently at ${currentDepth}m. Drop ${change}m.`;
        correctAnswer = currentDepth - change;
    } else {
        qText.innerText = `Currently at ${currentDepth}m. Rise ${change}m.`;
        correctAnswer = currentDepth + change;
    }
    
    // Generate options
    let options = [correctAnswer];
    while(options.length < 3) {
        let wrong;
        if (Math.random() > 0.5) {
            // Common mistake: add instead of subtract or vice versa
            wrong = isDrop ? currentDepth + change : currentDepth - change;
        } else {
            // Just random offset
            let offset = (Math.floor(Math.random() * 5) + 1) * 10;
            wrong = Math.random() > 0.5 ? correctAnswer + offset : correctAnswer - offset;
        }
        
        if (!options.includes(wrong) && wrong <= 0) {
            options.push(wrong);
        }
    }
    
    // Shuffle options
    options.sort(() => Math.random() - 0.5);
    
    answersGrid.innerHTML = '';
    options.forEach(opt => {
        let btn = document.createElement('button');
        btn.className = 'btn-answer';
        btn.innerText = `${opt}m`;
        btn.onclick = () => checkAnswer(opt);
        answersGrid.appendChild(btn);
    });
}

function checkAnswer(val) {
    if (val === correctAnswer) {
        // Correct
        playBubble();
        score += 10;
        scoreEl.innerText = score;
        
        // Trigger bubble anim
        bubble.classList.remove('bubble-anim');
        void bubble.offsetWidth; // reflow
        bubble.classList.add('bubble-anim');
        
        // Move submarine visually
        currentDepth = correctAnswer;
        updateSubmarinePosition();
        
        // Next round
        setTimeout(generateRound, 1000);
    } else {
        // Wrong
        playAlarm();
        document.body.classList.add('flash-red');
        setTimeout(() => document.body.classList.remove('flash-red'), 500);
        score = Math.max(0, score - 5);
        scoreEl.innerText = score;
    }
}

function updateSubmarinePosition() {
    // Map 0 to -1000 to percentages 10% to 100%
    // 0m = 10%
    // -1000m = 100%
    let percentage = 10 + (Math.abs(currentDepth) / 1000) * 90;
    sub.style.top = `${percentage}%`;
}

btnStart.addEventListener('click', () => {
    overlay.classList.remove('visible');
    currentDepth = -50;
    score = 0;
    scoreEl.innerText = score;
    updateSubmarinePosition();
    generateRound();
});
