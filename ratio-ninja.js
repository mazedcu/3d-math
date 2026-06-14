const numAEl = document.getElementById('num-a');
const numBEl = document.getElementById('num-b');
const buttonBank = document.getElementById('button-bank');
const btnNext = document.getElementById('btn-next');
const btnSubmit = document.getElementById('btn-submit');
const animLayer = document.getElementById('anim-layer');
const flyingNumber = document.getElementById('flying-number');
const flyingDigit = document.getElementById('flying-digit');
const slashLine = document.getElementById('slash-line');
const msgToast = document.getElementById('msg-toast');
const announceOverlay = document.getElementById('announcement-overlay');
const btnStart = document.getElementById('btn-start');

let numA = 0;
let numB = 0;

let currentRound = 1;
let score = 0;
const totalRounds = 5;

// Audio Context setup
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

function playSlashSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const bufferSize = audioCtx.sampleRate * 0.2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    noiseSource.start();
}

function playClankSound() {
    playTone(800, 'square', 0.1, 0.2);
    setTimeout(() => playTone(600, 'sawtooth', 0.2, 0.2), 50);
}

function playSuccessSound() {
    playTone(400, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(600, 'sine', 0.1, 0.1), 100);
    setTimeout(() => playTone(800, 'sine', 0.3, 0.1), 200);
}

function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
}

// Generate buttons
for (let i = 2; i <= 10; i++) {
    const btn = document.createElement('button');
    btn.className = 'btn-number';
    btn.innerText = i;
    btn.onclick = (e) => handleCut(i, e.target);
    buttonBank.appendChild(btn);
}

function showToast(msg) {
    msgToast.innerText = msg;
    msgToast.style.opacity = 1;
    setTimeout(() => {
        msgToast.style.opacity = 0;
    }, 2000);
}

function updateScores() {
    document.getElementById('score-p1').innerText = score;
}

function showAnnouncement(title, subtitle, btnText) {
    document.getElementById('announce-title').innerText = title;
    document.getElementById('announce-subtitle').innerText = subtitle;
    btnStart.innerText = btnText;
    announceOverlay.classList.add('visible');
}

function endGame() {
    document.getElementById('announce-emoji').innerText = '🏆';
    showAnnouncement("GAME OVER", `Final Score: ${score}\n\nGreat job!`, "PLAY AGAIN");
}

btnStart.addEventListener('click', () => {
    announceOverlay.classList.remove('visible');
    if (document.getElementById('announce-title').innerText === "GAME OVER") {
        currentRound = 1;
        score = 0;
        updateScores();
    }
    initRound();
});

btnNext.addEventListener('click', () => {
    btnNext.style.display = 'none';
    currentRound++;
    if (currentRound > totalRounds) {
        endGame();
    } else {
        initRound();
    }
});

btnSubmit.addEventListener('click', () => {
    if (gcd(numA, numB) === 1) {
        playSuccessSound();
        showToast("Correct! +10 Points");
        document.querySelectorAll('.btn-number').forEach(b => b.disabled = true);
        btnSubmit.style.display = 'none';
        btnNext.style.display = 'block';
        score += 10;
        updateScores();
    } else {
        playClankSound();
        showToast("Not quite! Keep cutting.");
    }
});

function initRound() {
    document.getElementById('try-count').innerText = currentRound;
    
    // Generate a ratio that can be simplified
    let targetA = Math.floor(Math.random() * 5) + 1;
    let targetB = Math.floor(Math.random() * 5) + 1;
    while (gcd(targetA, targetB) !== 1 || targetA === targetB) {
        targetA = Math.floor(Math.random() * 5) + 1;
        targetB = Math.floor(Math.random() * 5) + 1;
    }
    
    let factor1 = Math.floor(Math.random() * 4) + 2; 
    let factor2 = Math.floor(Math.random() * 3) + 2; 
    
    let multiplier = factor1 * factor2;
    if (multiplier > 12) multiplier = Math.floor(Math.random() * 6) + 2;
    
    numA = targetA * multiplier;
    numB = targetB * multiplier;
    
    updateDisplay();
    
    document.querySelectorAll('.btn-number').forEach(b => b.disabled = false);
    btnNext.style.display = 'none';
    btnSubmit.style.display = 'block';
}

function updateDisplay() {
    numAEl.innerText = numA;
    numBEl.innerText = numB;
    numAEl.classList.remove('slashed');
    numBEl.classList.remove('slashed');
}

function handleCut(divisor, btnElement) {
    if (numA % divisor === 0 && numB % divisor === 0) {
        animateSwordCut(divisor, btnElement, () => {
            numA = numA / divisor;
            numB = numB / divisor;
            
            numAEl.classList.add('slashed');
            numBEl.classList.add('slashed');
            
            setTimeout(() => {
                updateDisplay();
            }, 500); 
        });
    } else {
        playClankSound();
        showToast(`Clank! ${divisor} doesn't divide both cleanly!`);
        document.getElementById('ratio-container').classList.add('shake');
        setTimeout(() => {
            document.getElementById('ratio-container').classList.remove('shake');
        }, 400);
    }
}

function animateSwordCut(divisor, btnElement, callback) {
    flyingDigit.innerText = divisor;
    
    const layerRect = animLayer.getBoundingClientRect();
    const btnRect = btnElement.getBoundingClientRect();
    
    const startX = btnRect.left + btnRect.width/2 - layerRect.left;
    const startY = btnRect.top + btnRect.height/2 - layerRect.top;
    
    flyingNumber.style.transition = 'none';
    flyingNumber.style.transform = `translate(${startX - layerRect.width/2}px, ${startY - layerRect.height/2}px) scale(0.2)`;
    flyingNumber.style.opacity = 0;
    slashLine.style.opacity = 0;
    
    void flyingNumber.offsetWidth;
    
    flyingNumber.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s';
    flyingNumber.style.transform = `translate(-50%, -50%) scale(1.5)`;
    flyingNumber.style.opacity = 1;
    
    setTimeout(() => {
        playSlashSound();
        
        slashLine.style.transition = 'none';
        slashLine.style.width = '0px';
        slashLine.style.opacity = 1;
        void slashLine.offsetWidth;
        
        slashLine.style.transition = 'width 0.2s ease-out, opacity 0.4s 0.2s';
        slashLine.style.width = '400px';
        slashLine.style.opacity = 0;
        
        flyingNumber.style.transition = 'transform 0.5s, opacity 0.3s 0.2s';
        flyingNumber.style.transform = `translate(100px, -50%) scale(2) rotate(45deg)`;
        flyingNumber.style.opacity = 0;
        
        callback();
        
    }, 400);
}
