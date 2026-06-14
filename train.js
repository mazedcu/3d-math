const ticket = document.getElementById('ticket');
const hIn = document.getElementById('h-in');
const mIn = document.getElementById('m-in');
const ampmIn = document.getElementById('ampm-in');
const btnSubmit = document.getElementById('btn-submit');
const scoreEl = document.getElementById('score');

let startTotalMins = 0;
let travelTotalMins = 0;
let endTotalMins = 0;
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

function playPunch() {
    playTone(800, 'square', 0.1, 0.1);
    setTimeout(() => playTone(600, 'square', 0.1, 0.1), 100);
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
    hIn.value = '';
    mIn.value = '';
    
    let startH = Math.floor(Math.random() * 12) + 1;
    let startM = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
    let startIsPM = Math.random() > 0.5;
    
    let travelH = Math.floor(Math.random() * 3) + 1; // 1 to 3 hours
    let travelM = Math.floor(Math.random() * 4) * 15;
    if (travelH === 0 && travelM === 0) travelM = 30;
    
    let start24 = startH;
    if (startIsPM && startH !== 12) start24 += 12;
    if (!startIsPM && startH === 12) start24 = 0;
    
    startTotalMins = start24 * 60 + startM;
    travelTotalMins = travelH * 60 + travelM;
    endTotalMins = (startTotalMins + travelTotalMins) % (24 * 60);
    
    let startMStr = startM === 0 ? "00" : startM;
    let startAMPM = startIsPM ? "PM" : "AM";
    
    let tH = travelH > 0 ? `${travelH}h ` : '';
    let tM = travelM > 0 ? `${travelM}m` : '';
    
    ticket.innerHTML = `
        Departure: ${startH}:${startMStr} ${startAMPM}<br>
        Travel Time: ${tH}${tM}<br>
        <strong>Arrival Time?</strong>
    `;
}

btnSubmit.addEventListener('click', () => {
    let h = parseInt(hIn.value);
    let m = parseInt(mIn.value);
    let ampm = ampmIn.value;
    
    if (isNaN(h) || isNaN(m)) return;
    
    playPunch();
    
    let h24 = h;
    if (ampm === "PM" && h !== 12) h24 += 12;
    if (ampm === "AM" && h === 12) h24 = 0;
    
    let guessMins = h24 * 60 + m;
    
    if (guessMins === endTotalMins) {
        playSuccess();
        score += 10;
        scoreEl.innerText = score;
        ticket.style.background = '#dcfce3';
        setTimeout(() => {
            ticket.style.background = '#fff';
            generateRound();
        }, 1500);
    } else {
        playError();
        score = Math.max(0, score - 5);
        scoreEl.innerText = score;
        ticket.style.background = '#fee2e2';
        setTimeout(() => {
            ticket.style.background = '#fff';
        }, 1000);
    }
});

generateRound();
