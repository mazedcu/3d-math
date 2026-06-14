const hpDisplay = document.getElementById('hp-display');
const baseIn = document.getElementById('base-in');
const expIn = document.getElementById('exp-in');
const btnFire = document.getElementById('btn-fire');
const scoreEl = document.getElementById('score');
const slime = document.getElementById('slime');
const laser = document.getElementById('laser');

let targetHp = 0;
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
    playTone(600, 'square', 0.2, 0.1);
    setTimeout(() => playTone(800, 'square', 0.1, 0.1), 100);
}

function playHit() {
    playTone(200, 'sawtooth', 0.3, 0.2);
    setTimeout(() => playTone(100, 'sawtooth', 0.4, 0.2), 100);
}

function playMiss() {
    playTone(150, 'sine', 0.3, 0.2);
}

function generateRound() {
    slime.classList.remove('hit-anim');
    laser.style.height = '0';
    
    const possible = [
        {b:2, e:3}, {b:2, e:4}, {b:2, e:5}, {b:2, e:6},
        {b:3, e:2}, {b:3, e:3}, {b:3, e:4},
        {b:4, e:2}, {b:4, e:3},
        {b:5, e:2}, {b:5, e:3},
        {b:10, e:2}, {b:10, e:3}
    ];
    
    const choice = possible[Math.floor(Math.random() * possible.length)];
    targetHp = Math.pow(choice.b, choice.e);
    hpDisplay.innerText = targetHp;
    
    baseIn.value = '';
    expIn.value = '';
}

btnFire.addEventListener('click', () => {
    let b = parseInt(baseIn.value);
    let e = parseInt(expIn.value);
    
    if (isNaN(b) || isNaN(e)) return;
    
    playLaser();
    laser.style.height = '250px';
    
    setTimeout(() => {
        let dmg = Math.pow(b, e);
        if (dmg === targetHp) {
            // Hit!
            playHit();
            slime.classList.add('hit-anim');
            score += 10;
            scoreEl.innerText = score;
            setTimeout(generateRound, 1000);
        } else {
            playMiss();
            laser.style.height = '0';
            score = Math.max(0, score - 5);
            scoreEl.innerText = score;
        }
    }, 200);
});

generateRound();
