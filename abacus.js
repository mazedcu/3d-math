// ===========================
// Virtual Abacus — Game Logic
// ===========================

const COLUMNS = [
    { label: 'Thousands', place: 1000 },
    { label: 'Hundreds',  place: 100  },
    { label: 'Tens',      place: 10   },
    { label: 'Units',     place: 1    },
];

// state: heaven is 0 or 1. earth is 0 to 4.
let state = COLUMNS.map(() => ({ heaven: 0, earth: 0 }));

let score = 0;
let streak = 0;

let currentPhase = 1; // 1 = Step 1 (Setup), 2 = Step 2 (Math)
let challenge = null; 

// DOM Elements
const uiStep = document.getElementById('task-step');
const uiText = document.getElementById('task-text');
const uiHint = document.getElementById('task-hint');
const uiScore = document.getElementById('score-val');
const uiStreak = document.getElementById('streak-val');
const btnSubmit = document.getElementById('btn-submit');
const btnReset = document.getElementById('btn-reset');
const colsContainer = document.getElementById('abacus-cols');

function init() {
    buildAbacus();
    renderAbacus();
    
    btnSubmit.addEventListener('click', onSubmit);
    btnReset.addEventListener('click', () => {
        state = COLUMNS.map(() => ({ heaven: 0, earth: 0 }));
        renderAbacus();
    });
    
    generateChallenge();
}

function buildAbacus() {
    colsContainer.innerHTML = '';
    COLUMNS.forEach((col, ci) => {
        const colDiv = document.createElement('div');
        colDiv.className = 'col-container';
        
        const label = document.createElement('div');
        label.className = 'col-label';
        label.innerText = col.label;
        colDiv.appendChild(label);
        
        const abacusCol = document.createElement('div');
        abacusCol.className = 'abacus-col';
        
        // Heaven section (1 bead)
        const heavenSec = document.createElement('div');
        heavenSec.className = 'heaven-section';
        const hBead = document.createElement('div');
        hBead.className = 'bead heaven-bead';
        hBead.id = `heaven-${ci}`;
        hBead.addEventListener('click', () => toggleHeaven(ci));
        heavenSec.appendChild(hBead);
        abacusCol.appendChild(heavenSec);
        
        // Earth section (4 beads)
        const earthSec = document.createElement('div');
        earthSec.className = 'earth-section';
        // index 0 is top-most bead, index 3 is bottom-most bead
        for(let i=0; i<4; i++) {
            const eBead = document.createElement('div');
            eBead.className = 'bead earth-bead';
            eBead.id = `earth-${ci}-${i}`;
            eBead.addEventListener('click', () => toggleEarth(ci, i));
            earthSec.appendChild(eBead);
        }
        abacusCol.appendChild(earthSec);
        
        colDiv.appendChild(abacusCol);
        
        const valDiv = document.createElement('div');
        valDiv.className = 'col-value';
        valDiv.id = `val-${ci}`;
        valDiv.innerText = '0';
        colDiv.appendChild(valDiv);
        
        colsContainer.appendChild(colDiv);
    });
}

function toggleHeaven(ci) {
    state[ci].heaven = state[ci].heaven === 0 ? 1 : 0;
    renderAbacus();
}

function toggleEarth(ci, beadIdx) {
    // beadIdx is 0 (top) to 3 (bottom).
    // If earth value is V, top V beads are UP (active).
    const curVal = state[ci].earth;
    if (beadIdx < curVal) {
        // This bead is currently UP. Clicking it pulls it DOWN.
        // The new value becomes beadIdx.
        state[ci].earth = beadIdx;
    } else {
        // This bead is currently DOWN. Clicking it pushes it UP.
        // The new value becomes beadIdx + 1.
        state[ci].earth = beadIdx + 1;
    }
    renderAbacus();
}

function renderAbacus() {
    COLUMNS.forEach((col, ci) => {
        const s = state[ci];
        
        // Heaven Bead: 100px section. Bead is ~40px. 60px gap.
        // Inactive = top (0px). Active = bottom (60px).
        const hBead = document.getElementById(`heaven-${ci}`);
        hBead.style.top = s.heaven === 1 ? '60px' : '0px';
        
        // Earth Beads: 220px section. 4 beads = 160px. 60px gap.
        // Active beads stack at top (i * 40px). Inactive stack at bottom (i * 40px + 60px).
        for(let i=0; i<4; i++) {
            const eBead = document.getElementById(`earth-${ci}-${i}`);
            if (i < s.earth) {
                eBead.style.top = (i * 40) + 'px'; // Pushed UP
            } else {
                eBead.style.top = (i * 40 + 60) + 'px'; // Pulled DOWN
            }
        }
        
        // Column label value
        const colVal = s.heaven * 5 + s.earth;
        document.getElementById(`val-${ci}`).innerText = colVal;
    });
}

function getAbacusValue() {
    let total = 0;
    COLUMNS.forEach((col, ci) => {
        const s = state[ci];
        total += (s.heaven * 5 + s.earth) * col.place;
    });
    return total;
}

function generateChallenge() {
    // Simple logic: Base from 10 to 999.
    const isAdd = Math.random() > 0.5;
    const base = Math.floor(Math.random() * 899) + 10;
    let op = 0;
    
    if (isAdd) {
        op = Math.floor(Math.random() * 499) + 1; 
        challenge = {
            base: base,
            op: op,
            sign: '+',
            ans1: base,
            ans2: base + op
        };
    } else {
        op = Math.floor(Math.random() * (base - 1)) + 1;
        challenge = {
            base: base,
            op: op,
            sign: '−',
            ans1: base,
            ans2: base - op
        };
    }
    
    currentPhase = 1;
    updateHUD();
}

function updateHUD() {
    if (currentPhase === 1) {
        uiStep.innerText = 'Step 1';
        uiText.innerHTML = `Set <span style="color:#fbbf24">${challenge.base}</span> on the abacus`;
        uiHint.innerText = 'Move the beads to represent the starting number.';
        btnSubmit.innerText = 'Next Step';
    } else if (currentPhase === 2) {
        uiStep.innerText = 'Step 2';
        const color = challenge.sign === '+' ? '#34d399' : '#f87171';
        const word = challenge.sign === '+' ? 'Add' : 'Subtract';
        uiText.innerHTML = `Now ${word} <span style="color:${color}">${challenge.op}</span>`;
        uiHint.innerText = 'Use the beads to perform the math and find the answer!';
        btnSubmit.innerText = 'Submit Answer';
    }
}

function showNotification(msg, color) {
    const notif = document.getElementById('notification');
    const notifMsg = document.getElementById('notif-msg');
    notif.style.borderColor = color;
    notif.style.boxShadow = `0 20px 50px rgba(0,0,0,0.5), 0 0 30px ${color}55`;
    notifMsg.innerHTML = msg;
    notif.classList.add('show');
    setTimeout(() => {
        notif.classList.remove('show');
    }, 1500);
}

function onSubmit() {
    const val = getAbacusValue();
    if (currentPhase === 1) {
        if (val === challenge.ans1) {
            showNotification('Great! Now for the math... 🧮', '#3b82f6');
            currentPhase = 2;
            updateHUD();
        } else {
            showNotification(`Oops, that is ${val}, not ${challenge.base} ❌`, '#ef4444');
            streak = 0;
            uiStreak.innerText = streak;
        }
    } else if (currentPhase === 2) {
        if (val === challenge.ans2) {
            showNotification(`Correct! ${challenge.base} ${challenge.sign} ${challenge.op} = ${challenge.ans2} 🌟`, '#34d399');
            score += 20;
            streak++;
            uiScore.innerText = score;
            uiStreak.innerText = streak;
            setTimeout(() => {
                state = COLUMNS.map(() => ({ heaven: 0, earth: 0 }));
                renderAbacus();
                generateChallenge();
            }, 1800);
        } else {
            showNotification(`Incorrect! You have ${val}. Try again! ❌`, '#ef4444');
            streak = 0;
            uiStreak.innerText = streak;
        }
    }
}

// Start game
init();
