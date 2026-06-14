const mirror = document.getElementById('mirror');
const angleVal = document.getElementById('angle-val');
const target = document.getElementById('target');
const beamIn = document.getElementById('beam-in');
const beamOut = document.getElementById('beam-out');
const scoreEl = document.getElementById('score');
const btnFire = document.getElementById('btn-fire');
const overlay = document.getElementById('announcement-overlay');
const btnStart = document.getElementById('btn-start');

let currentAngle = 0;
let targetAngle = 0;
let score = 0;

// Audio context
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

function playLaser() {
    playTone(800, 'sawtooth', 0.1, 0.1);
    setTimeout(() => playTone(1200, 'sawtooth', 0.2, 0.1), 50);
}

function playHit() {
    setTimeout(() => {
        playTone(400, 'sine', 0.1, 0.2);
        setTimeout(() => playTone(600, 'sine', 0.3, 0.2), 100);
    }, 200);
}

function playMiss() {
    setTimeout(() => {
        playTone(150, 'square', 0.3, 0.1);
    }, 200);
}

function changeAngle(delta) {
    currentAngle += delta;
    if (currentAngle > 90) currentAngle = 90;
    if (currentAngle < -90) currentAngle = -90;
    
    angleVal.innerText = currentAngle;
    mirror.style.transform = `rotate(${-currentAngle}deg)`; // Negative because CSS rotate is clockwise, we want standard math (counter-clockwise)
}

// Possible target angles (reflection angles)
// Remember: reflection angle = 2 * mirror_angle
// So target angles must be even
const possibleTargets = [90, -90, 60, -60, 30, -30];

function generateRound() {
    target.classList.remove('hit');
    beamIn.style.width = '0';
    beamOut.style.width = '0';
    beamOut.style.transition = 'none'; // reset without animation
    
    // Pick random target angle
    targetAngle = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
    
    // Position target
    // Center of mirror is at (400, 250) in game-area
    // Math.cos takes radians.
    const rad = targetAngle * Math.PI / 180;
    const radius = 200;
    
    // Subtracted Y because top is 0 and bottom is positive in CSS
    const tx = 400 + radius * Math.cos(rad);
    const ty = 250 - radius * Math.sin(rad);
    
    target.style.left = `${tx - 30}px`;
    target.style.top = `${ty - 30}px`;
    
    btnFire.disabled = false;
    btnFire.style.opacity = 1;
}

btnFire.addEventListener('click', () => {
    btnFire.disabled = true;
    btnFire.style.opacity = 0.5;
    
    playLaser();
    
    // Fire incoming beam
    beamIn.style.width = '275px'; // Hits the mirror center
    
    // Calculate outgoing beam
    const reflectedAngle = currentAngle * 2;
    
    setTimeout(() => {
        beamOut.style.transition = 'width 0.3s linear';
        beamOut.style.transform = `rotate(${-reflectedAngle}deg)`;
        beamOut.style.width = '600px'; // Shoot off screen
        
        if (reflectedAngle === targetAngle) {
            target.classList.add('hit');
            playHit();
            score += 10;
            scoreEl.innerText = score;
            setTimeout(generateRound, 1500);
        } else {
            playMiss();
            score = Math.max(0, score - 5);
            scoreEl.innerText = score;
            
            // Retract beam after miss to let them try again
            setTimeout(() => {
                beamIn.style.width = '0';
                beamOut.style.transition = 'none';
                beamOut.style.width = '0';
                btnFire.disabled = false;
                btnFire.style.opacity = 1;
            }, 1000);
        }
        
    }, 200); // Wait for incoming beam to hit mirror
});

btnStart.addEventListener('click', () => {
    overlay.classList.remove('visible');
    score = 0;
    scoreEl.innerText = score;
    currentAngle = 0;
    changeAngle(0);
    generateRound();
});
