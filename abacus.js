// ===========================
// Virtual Abacus — Game Logic
// ===========================

// A standard Soroban (Japanese abacus) style:
//   - 4 columns: Thousands, Hundreds, Tens, Units (can go up to 9999)
//   - Each column has: 1 heaven bead (worth 5) + 4 earth beads (worth 1 each)
//   - Total per column max = 5+4 = 9

const COLUMNS = [
    { label: 'Thousands', place: 1000 },
    { label: 'Hundreds',  place: 100  },
    { label: 'Tens',      place: 10   },
    { label: 'Units',     place: 1    },
];

// State: for each column, track heaven bead and 4 earth beads
// heaven: 0 (up=inactive) or 1 (down=active, worth 5)
// earth: array of 4, each 0 (up=inactive) or 1 (down=active, worth 1)
let state = COLUMNS.map(() => ({ heaven: 0, earth: [0, 0, 0, 0] }));

let score = 0;
let streak = 0;
let currentAnswer = 0;
let currentPoints = 10;

// ---- Challenge Generator ----
const CHALLENGE_TYPES = [
    genAddition,
    genSubtraction,
    genShowNumber,
    genMultiplySmall,
];

function genShowNumber() {
    const n = randInt(1, 999);
    return {
        type: 'SHOW ON ABACUS',
        text: `Set the number <span style="color:#fbbf24">${n}</span> on the abacus`,
        answer: n,
        hint: 'Slide the beads to represent the number, then press Submit!',
        points: 10,
    };
}

function genAddition() {
    const a = randInt(1, 499);
    const b = randInt(1, 499);
    return {
        type: 'ADDITION',
        text: `What is <span style="color:#fbbf24">${a}</span> + <span style="color:#34d399">${b}</span> ?`,
        answer: a + b,
        hint: `Calculate ${a} + ${b}, then set the answer on the abacus!`,
        points: 15,
    };
}

function genSubtraction() {
    const a = randInt(50, 999);
    const b = randInt(1, a);
    return {
        type: 'SUBTRACTION',
        text: `What is <span style="color:#fbbf24">${a}</span> − <span style="color:#f87171">${b}</span> ?`,
        answer: a - b,
        hint: `Calculate ${a} − ${b}, then set the answer on the abacus!`,
        points: 15,
    };
}

function genMultiplySmall() {
    const a = randInt(2, 9);
    const b = randInt(2, 9);
    return {
        type: 'MULTIPLICATION',
        text: `What is <span style="color:#fbbf24">${a}</span> × <span style="color:#c084fc">${b}</span> ?`,
        answer: a * b,
        hint: `Calculate ${a} × ${b}, then set the answer on the abacus!`,
        points: 20,
    };
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---- Build Abacus DOM ----
function buildAbacus() {
    const labelsEl = document.getElementById('abacus-labels');
    const innerEl = document.getElementById('abacus-inner');
    labelsEl.innerHTML = '';
    innerEl.innerHTML = '';

    COLUMNS.forEach((col, ci) => {
        // Label
        const lbl = document.createElement('div');
        lbl.className = 'col-label';
        lbl.textContent = col.label;
        labelsEl.appendChild(lbl);
    });

    // Heaven row
    const heavenRow = document.createElement('div');
    heavenRow.className = 'abacus-row';
    const rod1 = document.createElement('div'); rod1.className = 'abacus-rod'; heavenRow.appendChild(rod1);

    COLUMNS.forEach((col, ci) => {
        const cell = document.createElement('div');
        cell.className = 'bead-col';
        const bead = document.createElement('div');
        bead.className = 'bead bead-heaven';
        bead.id = `heaven-${ci}`;
        bead.title = `Click to toggle (worth 5 in ${col.label} column)`;
        bead.addEventListener('click', () => toggleHeaven(ci));
        cell.appendChild(bead);
        heavenRow.appendChild(cell);
    });
    innerEl.appendChild(heavenRow);

    // Divider
    const divider = document.createElement('div');
    divider.id = 'divider-bar';
    innerEl.appendChild(divider);

    // Earth rows (4 beads per column, shown as 4 rows)
    for (let row = 0; row < 4; row++) {
        const earthRow = document.createElement('div');
        earthRow.className = 'abacus-row';
        const rod = document.createElement('div'); rod.className = 'abacus-rod'; earthRow.appendChild(rod);

        COLUMNS.forEach((col, ci) => {
            const cell = document.createElement('div');
            cell.className = 'bead-col';
            const bead = document.createElement('div');
            bead.className = 'bead bead-earth';
            bead.id = `earth-${ci}-${row}`;
            bead.title = `Click to toggle (worth 1 in ${col.label} column)`;
            bead.addEventListener('click', () => toggleEarth(ci, row));
            cell.appendChild(bead);
            earthRow.appendChild(cell);
        });
        innerEl.appendChild(earthRow);
    }
}

// ---- Toggle Logic ----
// Earth beads: clicking a bead toggles it AND all beads below/above it
// This mimics real abacus behaviour where pushing from bottom activates all below it

function toggleEarth(colIdx, row) {
    // If this bead is active, deactivate it and all below it
    // If inactive, activate it and all above it
    const col = state[colIdx];
    if (col.earth[row] === 1) {
        // Deactivate this and all beads below (higher row index = closer to bar)
        for (let r = row; r < 4; r++) col.earth[r] = 0;
    } else {
        // Activate this and all beads above (lower row index = further from bar)
        for (let r = 0; r <= row; r++) col.earth[r] = 1;
    }
    renderAbacus();
}

function toggleHeaven(colIdx) {
    state[colIdx].heaven = state[colIdx].heaven === 0 ? 1 : 0;
    renderAbacus();
}

// ---- Render ----
function renderAbacus() {
    COLUMNS.forEach((col, ci) => {
        const s = state[ci];
        const heavenEl = document.getElementById(`heaven-${ci}`);
        if (heavenEl) {
            heavenEl.classList.toggle('active', s.heaven === 1);
        }
        for (let row = 0; row < 4; row++) {
            const earthEl = document.getElementById(`earth-${ci}-${row}`);
            if (earthEl) {
                earthEl.classList.toggle('active', s.earth[row] === 1);
            }
        }
    });
    updateTotal();
}

function getAbacusValue() {
    let total = 0;
    COLUMNS.forEach((col, ci) => {
        const s = state[ci];
        const colVal = (s.heaven * 5 + s.earth.reduce((a, b) => a + b, 0)) * col.place;
        total += colVal;
    });
    return total;
}

function updateTotal() {
    const val = getAbacusValue();
    document.getElementById('total-display').textContent = val.toLocaleString();
}

// ---- Reset ----
function resetAbacus() {
    state = COLUMNS.map(() => ({ heaven: 0, earth: [0, 0, 0, 0] }));
    renderAbacus();
    playTone(300, 'sine', 0.15, 0.05);
}

// ---- Check Answer ----
function checkAnswer() {
    const abacusVal = getAbacusValue();
    if (abacusVal === currentAnswer) {
        // Correct!
        score += currentPoints;
        streak++;
        document.getElementById('score-val').textContent = score;
        document.getElementById('streak-val').textContent = streak;
        showHurray();
    } else {
        // Wrong
        streak = 0;
        document.getElementById('streak-val').textContent = streak;
        showWrong(abacusVal);
    }
}

// ---- Hurray Effect ----
function showHurray() {
    playSuccessSound();

    const overlay = document.getElementById('hurray-overlay');
    const emojis = ['🎉', '⭐', '🏆', '🚀', '🎯', '💫'];
    document.getElementById('hurray-emoji').textContent = emojis[Math.floor(Math.random() * emojis.length)];
    document.getElementById('hurray-sub').textContent = `You set ${currentAnswer.toLocaleString()} perfectly!`;
    document.getElementById('hurray-pts').textContent = `+${currentPoints} points`;
    overlay.classList.add('show');

    if (window.confetti) {
        confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.5 },
            colors: ['#fbbf24', '#34d399', '#60a5fa', '#c084fc', '#f87171'],
            zIndex: 600,
        });
    }

    setTimeout(() => {
        overlay.classList.remove('show');
        resetAbacus();
        loadChallenge();
    }, 2200);
}

function showWrong(got) {
    playErrorSound();
    const flash = document.getElementById('wrong-flash');
    flash.classList.add('show');
    setTimeout(() => flash.classList.remove('show'), 300);

    // Show quick toast
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(239,68,68,0.95);
        backdrop-filter: blur(10px);
        color: white; padding: 16px 32px;
        border-radius: 16px; font-size: 1.3rem;
        font-weight: 700; z-index: 800;
        border: 2px solid rgba(255,255,255,0.2);
        box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        font-family: 'Outfit', sans-serif;
        pointer-events: none;
        opacity: 0; transition: opacity 0.2s;
    `;
    toast.textContent = `Oops! You entered ${got.toLocaleString()}, try again!`;
    document.body.appendChild(toast);
    setTimeout(() => toast.style.opacity = '1', 10);
    setTimeout(() => toast.style.opacity = '0', 1500);
    setTimeout(() => toast.remove(), 1800);
}

// ---- Load Challenge ----
function loadChallenge() {
    const fn = CHALLENGE_TYPES[Math.floor(Math.random() * CHALLENGE_TYPES.length)];
    const ch = fn();
    currentAnswer = ch.answer;
    currentPoints = ch.points;

    document.getElementById('challenge-type').textContent = ch.type;
    document.getElementById('challenge-text').innerHTML = ch.text;
    document.getElementById('challenge-hint').textContent = ch.hint;
}

// ---- Audio ----
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playTone(freq, type, duration, vol = 0.1) {
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

function playSuccessSound() {
    [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => playTone(freq, 'sine', 0.3, 0.15), i * 80);
    });
}

function playErrorSound() {
    playTone(220, 'sawtooth', 0.3, 0.1);
    setTimeout(() => playTone(180, 'sawtooth', 0.3, 0.1), 100);
}

// ---- Init ----
buildAbacus();
renderAbacus();
loadChallenge();
