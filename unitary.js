const inputUnitary = document.getElementById('input-unitary');
const inputTotal = document.getElementById('input-total');
const btnSell = document.getElementById('btn-sell');
const svgScene = document.getElementById('svg-scene');
const errorMsg = document.getElementById('error-msg');
const wizardDialogue = document.getElementById('wizard-dialogue');

let oldQuantity = 0;
let oldCost = 0;
let newQuantity = 0;
let unitaryCost = 0;
let totalCost = 0;

let currentPlayer = 1;
let currentTry = 1;
let score1 = 0;
let score2 = 0;

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

function playSuccess() {
    playTone(600, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(800, 'sine', 0.1, 0.1), 100);
    setTimeout(() => playTone(1200, 'sine', 0.4, 0.1), 200);
}

function playFail() {
    playTone(300, 'sawtooth', 0.3, 0.1);
    setTimeout(() => playTone(150, 'sawtooth', 0.5, 0.15), 200);
}

function speakOrder(text) {
    window.speechSynthesis.cancel();
    // Strip HTML tags for speaking
    const plainText = text.replace(/<[^>]*>?/gm, '');
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.pitch = 1.2; // Cheerful seller
    utterance.rate = 1.0;
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
    document.getElementById('announce-title').style.color = currentPlayer === 1 ? '#c084fc' : '#f43f5e';
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
    // Generate valid unitary problem
    oldQuantity = Math.floor(Math.random() * 4) + 2; // 2 to 5
    unitaryCost = Math.floor(Math.random() * 8) + 3; // 3 to 10
    oldCost = oldQuantity * unitaryCost;
    
    newQuantity = oldQuantity;
    while (newQuantity === oldQuantity) {
        newQuantity = Math.floor(Math.random() * 8) + 2; // 2 to 9
    }
    
    totalCost = newQuantity * unitaryCost;
    
    const dialogue = `"Ah, you need <span>${newQuantity}</span> apples? My current rate is <span>${oldCost}</span> gold for <span>${oldQuantity}</span> apples!"`;
    wizardDialogue.innerHTML = dialogue;
    
    // Update HUD
    document.getElementById('turn-indicator').innerText = `P${currentPlayer}'S TURN`;
    document.getElementById('turn-indicator').style.color = currentPlayer === 1 ? '#c084fc' : '#f43f5e';
    document.getElementById('try-count').innerText = currentTry;
    
    // Reset UI
    inputUnitary.value = '';
    inputTotal.value = '';
    inputUnitary.disabled = false;
    inputTotal.disabled = false;
    inputUnitary.classList.remove('error');
    inputTotal.classList.remove('error');
    btnSell.style.display = 'block';
    
    svgScene.classList.remove('happy', 'angry');
    errorMsg.style.opacity = 0;
    
    speakOrder(dialogue);
}

function sellFruits() {
    const valUnitary = parseInt(inputUnitary.value);
    const valTotal = parseInt(inputTotal.value);
    
    inputUnitary.classList.remove('error');
    inputTotal.classList.remove('error');
    
    if (isNaN(valUnitary) || valUnitary < 0) {
        showError("Please enter the unitary cost!");
        inputUnitary.classList.add('error');
        return;
    }
    if (isNaN(valTotal) || valTotal < 0) {
        showError("Please enter the total cost!");
        inputTotal.classList.add('error');
        return;
    }
    
    // Disable inputs
    errorMsg.style.opacity = 0;
    inputUnitary.disabled = true;
    inputTotal.disabled = true;
    btnSell.style.display = 'none';
    
    playTone(800, 'sine', 0.1, 0.1);
    
    setTimeout(() => {
        if (valUnitary !== unitaryCost) {
            // Unitary is wrong
            playFail();
            svgScene.classList.add('angry');
            inputUnitary.classList.add('error');
            showError(`Wrong unitary price! Divide the cost (${oldCost}) by the quantity (${oldQuantity}).`);
            speakOrder("You miscalculated the unit price!");
            
            setTimeout(() => {
                nextTry();
            }, 3000);
            
        } else if (valTotal !== totalCost) {
            // Unitary is right, but total is wrong
            playFail();
            svgScene.classList.add('angry');
            inputTotal.classList.add('error');
            showError(`Unitary price is right, but total gold is wrong! Multiply ${unitaryCost} by ${newQuantity}.`);
            speakOrder("Almost! You calculated the unit price correctly, but you paid the wrong total amount!");
            
            setTimeout(() => {
                nextTry();
            }, 3000);
            
        } else {
            // Both are right!
            playSuccess();
            svgScene.classList.add('happy');
            if (currentPlayer === 1) score1 += 10;
            else score2 += 10;
            updateScores();
            
            setTimeout(() => {
                nextTry();
            }, 2500);
        }
    }, 500);
}

function nextTry() {
    currentTry++;
    if (currentTry > 5) {
        if (currentPlayer === 1) {
            currentPlayer = 2;
            currentTry = 1;
            document.getElementById('announce-emoji').innerText = '👨‍🌾';
            showAnnouncement("PLAYER 2", "Visit the market! Buy from 5 merchants.", "START P2");
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

btnSell.addEventListener('click', sellFruits);
