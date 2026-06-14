const grid = document.getElementById('grid');
const laser = document.getElementById('laser');
const asteroid = document.getElementById('asteroid');
const mIn = document.getElementById('m-in');
const bIn = document.getElementById('b-in');
const btnFire = document.getElementById('btn-fire');
const scoreEl = document.getElementById('score');

let targetX = 0;
let targetY = 0;
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

function playLaser() {
    playTone(800, 'square', 0.2, 0.1);
    setTimeout(() => playTone(600, 'square', 0.2, 0.1), 100);
}

function playExplosion() {
    playTone(150, 'sawtooth', 0.4, 0.2);
    setTimeout(() => playTone(100, 'sawtooth', 0.5, 0.2), 100);
}

function playMiss() {
    playTone(300, 'sine', 0.3, 0.1);
}

function generateRound() {
    laser.style.width = '0';
    laser.style.transition = 'none';
    asteroid.style.opacity = 1;
    asteroid.innerText = '☄️';
    mIn.value = '';
    bIn.value = '';
    
    // Grid is 10x10. Pick integer coordinates 2..8
    targetX = Math.floor(Math.random() * 7) + 2;
    targetY = Math.floor(Math.random() * 7) + 2;
    
    // Position asteroid (bottom-left origin)
    // 1 unit = 40px
    asteroid.style.left = `${targetX * 40}px`;
    asteroid.style.bottom = `${targetY * 40}px`;
}

btnFire.addEventListener('click', () => {
    let m = parseFloat(mIn.value);
    let b = parseFloat(bIn.value);
    
    if (isNaN(m) || isNaN(b)) return;
    
    playLaser();
    
    // Calculate laser angle
    // In CSS, rotate is clockwise, but our graph is standard math (y up)
    // So angle is -atan(m)
    let rad = Math.atan(m);
    let deg = rad * (180 / Math.PI);
    
    // Position laser origin at y=B
    laser.style.bottom = `${b * 40}px`;
    laser.style.transform = `rotate(${-deg}deg)`;
    
    // Fire!
    void laser.offsetWidth; // Reflow
    laser.style.transition = 'width 0.4s linear';
    laser.style.width = '600px';
    
    setTimeout(() => {
        // Check hit: y = mx + b
        // Use epsilon for floating point just in case, though m and b should be simple
        let expectedY = m * targetX + b;
        if (Math.abs(expectedY - targetY) < 0.01) {
            playExplosion();
            asteroid.innerText = '💥';
            score += 10;
            scoreEl.innerText = score;
            setTimeout(generateRound, 1500);
        } else {
            playMiss();
            score = Math.max(0, score - 5);
            scoreEl.innerText = score;
            setTimeout(() => {
                laser.style.width = '0';
            }, 1000);
        }
    }, 400);
});

generateRound();
