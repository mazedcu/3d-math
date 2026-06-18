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
// Weighted pool: addition & subtraction appear much more often
const CHALLENGE_TYPES = [
    // Addition — 5 slots
    genAddition, genAddition, genAdditionThreeNums, genAdditionLarge, genAdditionChain,
    // Subtraction — 5 slots
    genSubtraction, genSubtraction, genSubtractionFromRound, genSubtractionLarge, genSubtractionChain,
    // Mixed add/sub — 3 slots
    genMixedAddSub, genMixedAddSub, genMixedAddSub,
    // Others — 2 slots
    genShowNumber, genMultiplySmall,
];

// --- Addition variants ---

function genAddition() {
    const a = randInt(10, 499);
    const b = randInt(10, 499);
    return {
        type: 'ADDITION',
        text: `<span style="color:#fbbf24">${a}</span> + <span style="color:#34d399">${b}</span> = ?`,
        answer: a + b,
        hint: `Add ${a} and ${b}, then set the total on the abacus!`,
        points: 15,
    };
}

function genAdditionLarge() {
    const a = randInt(100, 900);
    const b = randInt(100, 9999 - a);
    return {
        type: 'ADDITION',
        text: `<span style="color:#fbbf24">${a}</span> + <span style="color:#34d399">${b}</span> = ?`,
        answer: a + b,
        hint: `Add ${a} and ${b} — the answer may reach the thousands!`,
        points: 20,
    };
}

function genAdditionThreeNums() {
    const a = randInt(10, 200);
    const b = randInt(10, 200);
    const c = randInt(10, 200);
    return {
        type: 'ADDITION',
        text: `<span style="color:#fbbf24">${a}</span> + <span style="color:#34d399">${b}</span> + <span style="color:#60a5fa">${c}</span> = ?`,
        answer: a + b + c,
        hint: `Add all three numbers together!`,
        points: 20,
    };
}

function genAdditionChain() {
    // Start from a base, give clue like "I have X apples. I get Y more. Then Z more."
    const base = randInt(5, 100);
    const add1 = randInt(5, 100);
    const add2 = randInt(5, 100);
    return {
        type: 'ADDITION STORY',
        text: `Ali has <span style="color:#fbbf24">${base}</span> apples. He gets <span style="color:#34d399">${add1}</span> more, then <span style="color:#60a5fa">${add2}</span> more. How many does he have?`,
        answer: base + add1 + add2,
        hint: `${base} + ${add1} + ${add2} = ?`,
        points: 20,
    };
}

// --- Subtraction variants ---

function genSubtraction() {
    const a = randInt(20, 500);
    const b = randInt(1, a - 1);
    return {
        type: 'SUBTRACTION',
        text: `<span style="color:#fbbf24">${a}</span> − <span style="color:#f87171">${b}</span> = ?`,
        answer: a - b,
        hint: `Subtract ${b} from ${a}!`,
        points: 15,
    };
}

function genSubtractionLarge() {
    const a = randInt(500, 9999);
    const b = randInt(100, a - 1);
    return {
        type: 'SUBTRACTION',
        text: `<span style="color:#fbbf24">${a}</span> − <span style="color:#f87171">${b}</span> = ?`,
        answer: a - b,
        hint: `Subtract ${b} from ${a} — use all four columns!`,
        points: 20,
    };
}

function genSubtractionFromRound() {
    const rounds = [100, 200, 500, 1000];
    const a = rounds[Math.floor(Math.random() * rounds.length)];
    const b = randInt(1, a - 1);
    return {
        type: 'SUBTRACTION',
        text: `<span style="color:#fbbf24">${a}</span> − <span style="color:#f87171">${b}</span> = ?`,
        answer: a - b,
        hint: `Subtract from a round number!`,
        points: 15,
    };
}

function genSubtractionChain() {
    const start = randInt(100, 500);
    const sub1 = randInt(10, Math.floor(start / 3));
    const sub2 = randInt(10, Math.floor(start / 3));
    return {
        type: 'SUBTRACTION STORY',
        text: `A shop has <span style="color:#fbbf24">${start}</span> items. It sells <span style="color:#f87171">${sub1}</span>, then <span style="color:#f87171">${sub2}</span> more. How many remain?`,
        answer: start - sub1 - sub2,
        hint: `${start} − ${sub1} − ${sub2} = ?`,
        points: 20,
    };
}

// --- Mixed Add & Subtract ---

function genMixedAddSub() {
    const a = randInt(50, 400);
    const b = randInt(10, 300);
    const c = randInt(10, Math.min(a + b - 1, 300));
    const ans = a + b - c;
    if (ans <= 0 || ans > 9999) return genAddition(); // safety fallback
    return {
        type: 'ADD & SUBTRACT',
        text: `<span style="color:#fbbf24">${a}</span> + <span style="color:#34d399">${b}</span> − <span style="color:#f87171">${c}</span> = ?`,
        answer: ans,
        hint: `First add ${a} + ${b} = ${a+b}, then subtract ${c}!`,
        points: 25,
    };
}

// --- Others ---

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

function genMultiplySmall() {
    const a = randInt(2, 9);
    const b = randInt(2, 9);
    return {
        type: 'MULTIPLICATION',
        text: `<span style="color:#fbbf24">${a}</span> × <span style="color:#c084fc">${b}</span> = ?`,
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
    clearCheck();
    playTone(300, 'sine', 0.15, 0.05);
}

// ---- Check & Submit ----
let lastCheckCorrect = false;

function doCheck() {
    const abacusVal = getAbacusValue();
    const resultEl = document.getElementById('check-result');
    const submitBtn = document.getElementById('btn-submit');

    if (abacusVal === currentAnswer) {
        // Correct!
        lastCheckCorrect = true;
        resultEl.className = 'correct';
        resultEl.textContent = `✓ Correct! ${abacusVal.toLocaleString()} is right!`;
        submitBtn.disabled = false;
        playTone(600, 'sine', 0.2, 0.1);
        // Glow the total display green
        document.getElementById('total-display').style.color = '#34d399';
        document.getElementById('total-display').style.textShadow = '0 0 20px rgba(52,211,153,0.6)';
    } else {
        // Wrong
        lastCheckCorrect = false;
        submitBtn.disabled = true;
        resultEl.className = 'wrong';
        resultEl.textContent = `✗ Got ${abacusVal.toLocaleString()}, not quite — try again!`;
        playErrorSound();
        // Flash red overlay
        const flash = document.getElementById('wrong-flash');
        flash.classList.add('show');
        setTimeout(() => flash.classList.remove('show'), 300);
        // Reset total display colour
        document.getElementById('total-display').style.color = '';
        document.getElementById('total-display').style.textShadow = '';
    }
}

function doSubmit() {
    if (!lastCheckCorrect) return;
    // Score and advance
    score += currentPoints;
    streak++;
    document.getElementById('score-val').textContent = score;
    document.getElementById('streak-val').textContent = streak;
    // Clear check state
    clearCheck();
    showHurray();
}

function clearCheck() {
    lastCheckCorrect = false;
    const resultEl = document.getElementById('check-result');
    resultEl.className = '';
    resultEl.textContent = '';
    document.getElementById('btn-submit').disabled = true;
    document.getElementById('total-display').style.color = '';
    document.getElementById('total-display').style.textShadow = '';
}

// Keep old name for any legacy references
function checkAnswer() { doCheck(); }


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
