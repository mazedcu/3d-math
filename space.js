const elCapacityText = document.getElementById('capacity-text');
const elPercentageText = document.getElementById('percentage-text');
const inputFuel = document.getElementById('input-fuel');
const btnLaunch = document.getElementById('btn-launch');
const svgRocket = document.getElementById('svg-rocket');
const fuelRect = document.getElementById('fuel-rect');
const errorMsg = document.getElementById('error-msg');

let currentCapacity = 0;
let targetPercentage = 0;
let targetFuel = 0;

let currentPlayer = 1;
let currentTry = 1;
let score1 = 0;
let score2 = 0;

// Audio Context setup (must resume on first interaction)
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

function playFill() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 1.2);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.2);
}

function playLaunch() {
    playTone(400, 'square', 0.1, 0.1);
    setTimeout(() => playTone(600, 'square', 0.1, 0.1), 100);
    setTimeout(() => playTone(800, 'square', 0.4, 0.1), 200);
    
    // Engine rumble
    setTimeout(() => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 2.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 2.5);
    }, 300);
}

function playFail() {
    playTone(200, 'sawtooth', 0.3, 0.1);
    setTimeout(() => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }, 300);
}

function speakOrder(capacity, percentage) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const text = `Cadet! The tank holds ${capacity} cells. We need exactly ${percentage} percent fuel to break orbit. Do the math!`;
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to make it sound like a captain (lower pitch)
    utterance.pitch = 0.8;
    utterance.rate = 1.1;
    
    window.speechSynthesis.speak(utterance);
}

const announceOverlay = document.getElementById('announcement-overlay');
const btnStart = document.getElementById('btn-start');

btnStart.addEventListener('click', () => {
    announceOverlay.classList.remove('visible');
    if (document.getElementById('announce-title').innerText === "GAME OVER") {
        currentPlayer = 1;
        currentTry = 1;
        score1 = 0;
        score2 = 0;
        updateScores();
    }
    initRound();
});

function updateScores() {
    document.getElementById('score-p1').innerText = score1;
    document.getElementById('score-p2').innerText = score2;
}

function showAnnouncement(title, subtitle, btnText) {
    document.getElementById('announce-title').innerText = title;
    document.getElementById('announce-title').style.color = currentPlayer === 1 ? '#38bdf8' : '#f43f5e';
    document.getElementById('announce-subtitle').innerText = subtitle;
    btnStart.innerText = btnText;
    announceOverlay.classList.add('visible');
}

function endGame() {
    let msg = score1 > score2 ? "Player 1 Wins!" : (score2 > score1 ? "Player 2 Wins!" : "It's a Tie!");
    document.getElementById('announce-emoji').innerText = '🏆';
    showAnnouncement("GAME OVER", `P1: ${score1} | P2: ${score2}\n\n${msg}`, "PLAY AGAIN");
}

function initRound() {
    // Generate valid percentage problem
    const capacities = [10, 20, 25, 40, 50, 100];
    const percentages = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90];
    
    let valid = false;
    while (!valid) {
        currentCapacity = capacities[Math.floor(Math.random() * capacities.length)];
        targetPercentage = percentages[Math.floor(Math.random() * percentages.length)];
        
        targetFuel = currentCapacity * (targetPercentage / 100);
        // Only accept integer results
        if (Number.isInteger(targetFuel)) {
            valid = true;
        }
    }
    
    elCapacityText.innerText = currentCapacity;
    elPercentageText.innerText = `${targetPercentage}%`;
    
    // Update HUD
    document.getElementById('turn-indicator').innerText = `P${currentPlayer}'S TURN`;
    document.getElementById('turn-indicator').style.color = currentPlayer === 1 ? '#38bdf8' : '#f43f5e';
    document.getElementById('try-count').innerText = currentTry;
    
    // Reset UI
    inputFuel.value = '';
    inputFuel.disabled = false;
    btnLaunch.style.display = 'block';
    
    svgRocket.classList.remove('launching', 'fail');
    // Reset fuel visual immediately without transition
    fuelRect.style.transition = 'none';
    fuelRect.setAttribute('y', '280');
    fuelRect.setAttribute('height', '0');
    // Force reflow
    void fuelRect.offsetWidth;
    fuelRect.style.transition = 'height 1s cubic-bezier(0.25, 1, 0.5, 1), y 1s cubic-bezier(0.25, 1, 0.5, 1)';
    
    errorMsg.style.opacity = 0;
    
    // Speak the order audibly
    speakOrder(currentCapacity, targetPercentage);
}

function launchRocket() {
    const fuelInput = parseInt(inputFuel.value);
    
    if (isNaN(fuelInput) || fuelInput < 0) {
        showError("Please enter a valid number of fuel cells!");
        return;
    }
    
    // Disable inputs
    errorMsg.style.opacity = 0;
    inputFuel.disabled = true;
    btnLaunch.style.display = 'none';
    
    // Play button click sound
    playTone(800, 'sine', 0.1, 0.1);
    
    // Visual fuel filling
    const maxFuelHeight = 120; // from SVG
    const baseY = 280;
    
    // Cap visual fill at 100% just so it doesn't break SVG
    const fillRatio = Math.min(fuelInput / currentCapacity, 1);
    const fillHeight = maxFuelHeight * fillRatio;
    const newY = baseY - fillHeight;
    
    // Only play fill sound if we are actually filling something
    if (fillRatio > 0) {
        setTimeout(playFill, 100);
    }
    
    fuelRect.setAttribute('y', newY);
    fuelRect.setAttribute('height', fillHeight);
    
    // Wait for fill animation (1s)
    setTimeout(() => {
        if (fuelInput === targetFuel) {
            // Success
            playLaunch();
            svgRocket.classList.add('launching');
            if (currentPlayer === 1) score1 += 10;
            else score2 += 10;
            updateScores();
            
            // Wait for fly animation (2.5s)
            setTimeout(() => {
                nextTry();
            }, 2500);
            
        } else {
            // Fail
            playFail();
            svgRocket.classList.add('fail');
            showError(`Incorrect! ${targetPercentage}% of ${currentCapacity} is ${targetFuel}.`);
            
            // Wait for smoke animation (2.5s)
            setTimeout(() => {
                nextTry();
            }, 3000);
        }
    }, 1200); // Wait 1.2s for fuel to settle
}

function nextTry() {
    currentTry++;
    if (currentTry > 5) {
        if (currentPlayer === 1) {
            currentPlayer = 2;
            currentTry = 1;
            document.getElementById('announce-emoji').innerText = '🚀';
            showAnnouncement("PLAYER 2", "Get ready for your 5 missions!", "START P2");
        } else {
            endGame();
        }
    } else {
        initRound();
    }
}

function showError(msg) {
    errorMsg.innerText = msg;
    errorMsg.style.opacity = 1;
    setTimeout(() => { errorMsg.style.opacity = 0; }, 3000);
}

btnLaunch.addEventListener('click', launchRocket);
