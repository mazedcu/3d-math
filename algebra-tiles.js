// ================================
//  Algebra Tiles — Game Logic
// ================================

// ---------- Equations Bank ----------
const EQUATIONS = [
    { eq: 'x + 3 = 7',     xCoeff: 1,  constant: 3,  rhs: 7,  answer: 4,  points: 10 },
    { eq: 'x + 5 = 12',    xCoeff: 1,  constant: 5,  rhs: 12, answer: 7,  points: 10 },
    { eq: '2x + 1 = 7',    xCoeff: 2,  constant: 1,  rhs: 7,  answer: 3,  points: 15 },
    { eq: '2x + 3 = 11',   xCoeff: 2,  constant: 3,  rhs: 11, answer: 4,  points: 15 },
    { eq: '3x + 2 = 11',   xCoeff: 3,  constant: 2,  rhs: 11, answer: 3,  points: 15 },
    { eq: '2x - 1 = 5',    xCoeff: 2,  constant: -1, rhs: 5,  answer: 3,  points: 20 },
    { eq: '3x - 4 = 8',    xCoeff: 3,  constant: -4, rhs: 8,  answer: 4,  points: 20 },
    { eq: '4x + 2 = 14',   xCoeff: 4,  constant: 2,  rhs: 14, answer: 3,  points: 20 },
    { eq: '2x + 5 = 13',   xCoeff: 2,  constant: 5,  rhs: 13, answer: 4,  points: 15 },
    { eq: '5x - 3 = 17',   xCoeff: 5,  constant: -3, rhs: 17, answer: 4,  points: 25 },
    { eq: '3x + 1 = 10',   xCoeff: 3,  constant: 1,  rhs: 10, answer: 3,  points: 15 },
    { eq: '4x - 2 = 10',   xCoeff: 4,  constant: -2, rhs: 10, answer: 3,  points: 20 },
    { eq: 'x - 2 = 5',     xCoeff: 1,  constant: -2, rhs: 5,  answer: 7,  points: 10 },
    { eq: '2x + 4 = 10',   xCoeff: 2,  constant: 4,  rhs: 10, answer: 3,  points: 15 },
    { eq: '6x + 1 = 13',   xCoeff: 6,  constant: 1,  rhs: 13, answer: 2,  points: 25 },
];

let score  = 0;
let streak = 0;
let currentEq = null;
let leftTiles = [];  // array of type strings placed on left panel
let rightTiles = []; // array of type strings placed on right panel

// ---------- Drag State ----------
let dragging = false;
let dragType = '';
let ghost = document.getElementById('drag-ghost');

// ---------- Init ----------
function init() {
    loadEquation();
    setupTrayDrag();
    setupDropZone();
}

// ---------- Load Equation ----------
function loadEquation() {
    const remaining = EQUATIONS.filter(e => e !== currentEq);
    currentEq = remaining[Math.floor(Math.random() * remaining.length)];

    document.getElementById('problem-eq').textContent = currentEq.eq;
    document.getElementById('answer-input').value = '';
    resetWorkspace();
}

// ---------- Reset Workspace ----------
function resetWorkspace() {
    clearFeedback();
    leftTiles = Array(currentEq.xCoeff).fill(currentEq.xCoeff > 0 ? 'x' : '-x');
    if (currentEq.constant > 0) {
        leftTiles.push(...Array(currentEq.constant).fill('1'));
    } else if (currentEq.constant < 0) {
        leftTiles.push(...Array(Math.abs(currentEq.constant)).fill('-1'));
    }

    rightTiles = [];
    if (currentEq.rhs > 0) {
        rightTiles.push(...Array(currentEq.rhs).fill('1'));
    } else if (currentEq.rhs < 0) {
        rightTiles.push(...Array(Math.abs(currentEq.rhs)).fill('-1'));
    }

    renderLeftPanel();
    renderRightPanel();
    updateStepBar();
}

// ---------- Setup Tray Drag (pointer events) ----------
function setupTrayDrag() {
    document.querySelectorAll('.tray-tile').forEach(trayEl => {
        trayEl.addEventListener('pointerdown', e => {
            e.preventDefault();
            dragType = trayEl.dataset.type;
            dragging = true;

            // Build ghost appearance
            ghost.style.display = 'block';
            ghost.style.borderRadius = dragType === 'x' || dragType === '-x' ? '8px' : '8px';
            ghost.innerHTML = '';

            const inner = document.createElement('div');
            inner.style.cssText = buildTileStyle(dragType);
            inner.textContent = dragType === 'x' ? 'x' : dragType === '-x' ? '−x' : dragType === '1' ? '1' : '−1';
            ghost.appendChild(inner);

            moveGhost(e.clientX, e.clientY);
            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
        });
    });
}

function buildTileStyle(type) {
    const base = 'border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-family:JetBrains Mono,monospace;color:white;box-shadow:3px 5px 15px rgba(0,0,0,0.5);';
    if (type === 'x')  return base + 'width:50px;height:100px;background:linear-gradient(135deg,#6d28d9,#a855f7);font-size:1.1rem;';
    if (type === '-x') return base + 'width:50px;height:100px;background:linear-gradient(135deg,#7f1d1d,#ef4444);font-size:1.1rem;';
    if (type === '1')  return base + 'width:50px;height:50px;background:linear-gradient(135deg,#065f46,#10b981);font-size:1.2rem;';
    return              base + 'width:50px;height:50px;background:linear-gradient(135deg,#7c2d12,#f97316);font-size:1.2rem;';
}

function moveGhost(x, y) {
    ghost.style.left = x + 'px';
    ghost.style.top  = y + 'px';
}

function onPointerMove(e) {
    if (!dragging) return;
    moveGhost(e.clientX, e.clientY);

    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const lRect = leftPanel.getBoundingClientRect();
    const rRect = rightPanel.getBoundingClientRect();

    const overL = e.clientX >= lRect.left && e.clientX <= lRect.right && e.clientY >= lRect.top && e.clientY <= lRect.bottom;
    const overR = e.clientX >= rRect.left && e.clientX <= rRect.right && e.clientY >= rRect.top && e.clientY <= rRect.bottom;

    leftPanel.classList.toggle('drag-over', overL);
    rightPanel.classList.toggle('drag-over', overR);
}

function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    ghost.style.display = 'none';

    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    leftPanel.classList.remove('drag-over');
    rightPanel.classList.remove('drag-over');

    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);

    const lRect = leftPanel.getBoundingClientRect();
    const rRect = rightPanel.getBoundingClientRect();
    const overL = e.clientX >= lRect.left && e.clientX <= lRect.right && e.clientY >= lRect.top && e.clientY <= lRect.bottom;
    const overR = e.clientX >= rRect.left && e.clientX <= rRect.right && e.clientY >= rRect.top && e.clientY <= rRect.bottom;

    if (overL) placeTile('left', dragType);
    else if (overR) placeTile('right', dragType);
}

// ---------- Setup Drop Zone (HTML5 fallback) ----------
function setupDropZone() {
    ['left', 'right'].forEach(side => {
        const panel = document.getElementById(side + '-panel');
        panel.addEventListener('dragover', e => { e.preventDefault(); panel.classList.add('drag-over'); });
        panel.addEventListener('dragleave', () => panel.classList.remove('drag-over'));
        panel.addEventListener('drop', e => {
            e.preventDefault();
            panel.classList.remove('drag-over');
            const type = e.dataTransfer.getData('text/plain');
            if (type) placeTile(side, type);
        });
    });

    document.querySelectorAll('.tray-tile').forEach(el => {
        el.setAttribute('draggable', 'true');
        el.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', el.dataset.type);
        });
    });
}

// ---------- Place Tile & Cancellation ----------
function placeTile(side, type) {
    const arr = side === 'left' ? leftTiles : rightTiles;
    
    // Zero-pair cancellation logic
    const opp = type === '1' ? '-1' : type === '-1' ? '1' : type === 'x' ? '-x' : 'x';
    const oppIdx = arr.indexOf(opp);
    
    if (oppIdx !== -1) {
        // Cancel out!
        arr.splice(oppIdx, 1);
        playTone(600, 'sine', 0.1, 0.05); // slightly different sound for cancel
    } else {
        arr.push(type);
        playTone(400, 'sine', 0.08, 0.06);
    }

    if (side === 'left') renderLeftPanel();
    else renderRightPanel();

    clearFeedback();
    updateStepBar();
}

function renderLeftPanel() {
    renderPanel('left-panel', leftTiles);
}

function renderRightPanel() {
    renderPanel('right-panel', rightTiles);
}

function renderPanel(panelId, arr) {
    const panel = document.getElementById(panelId);
    [...panel.querySelectorAll('.placed-tile')].forEach(t => t.remove());

    arr.forEach((type, idx) => {
        const tile = document.createElement('div');
        const cls = type === 'x' ? 'tile-x' : type === '-x' ? 'tile-nx' : type === '1' ? 'tile-1' : 'tile-n1';
        tile.className = `placed-tile ${cls}`;
        tile.textContent = type === 'x' ? 'x' : type === '-x' ? '−x' : type === '1' ? '1' : '−1';
        
        // No remove button anymore — must use zero-pairs!
        panel.appendChild(tile);
    });
}

// ---------- Step Bar ----------
function updateStepBar() {
    const s1 = document.getElementById('step1');
    const s2 = document.getElementById('step2');
    const tilesOk = checkTileMatch();

    if (tilesOk) {
        s1.className = 'step-pill done';
        s2.className = 'step-pill active';
    } else {
        s1.className = 'step-pill active';
        s2.className = 'step-pill';
    }
}

function checkTileMatch() {
    // Is x isolated? Left side has one x and no units, right side has answer units and no xs
    const lX = leftTiles.filter(t => t === 'x').length - leftTiles.filter(t => t === '-x').length;
    const lU = leftTiles.filter(t => t === '1').length - leftTiles.filter(t => t === '-1').length;
    
    const rX = rightTiles.filter(t => t === 'x').length - rightTiles.filter(t => t === '-x').length;
    const rU = rightTiles.filter(t => t === '1').length - rightTiles.filter(t => t === '-1').length;

    // Check if simplified to x = answer (or similar valid forms)
    // Most standard: left has 1x, right has answer
    return (lX === 1 && lU === 0 && rX === 0 && rU === currentEq.answer);
}

// ---------- Check Answer ----------
function checkAnswer() {
    const inputVal = document.getElementById('answer-input').value.trim();
    const feedbackEl = document.getElementById('feedback-msg');

    if (!inputVal) {
        feedbackEl.textContent = 'Please enter a value for x!';
        feedbackEl.className = 'wrong';
        return;
    }

    const xAnswer = parseFloat(inputVal);
    const tilesOk = checkTileMatch();
    const answerOk = xAnswer === currentEq.answer;

    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');

    if (tilesOk && answerOk) {
        // Full correct!
        leftPanel.classList.remove('wrong-glow');
        leftPanel.classList.add('correct-glow');
        rightPanel.classList.add('correct-glow');
        score += currentEq.points;
        streak++;
        document.getElementById('score-val').textContent = score;
        document.getElementById('streak-val').textContent = streak;
        playSuccessSound();
        showHurray(xAnswer);
    } else if (!tilesOk && answerOk) {
        // Answer right, tiles wrong
        leftPanel.classList.add('wrong-glow');
        feedbackEl.textContent = `x = ${currentEq.answer} is right, but your tiles don't match the left side yet! Check your tile placement.`;
        feedbackEl.className = 'wrong';
        playErrorSound();
        flashRed();
        streak = 0;
        document.getElementById('streak-val').textContent = streak;
    } else if (tilesOk && !answerOk) {
        // Tiles right, answer wrong
        leftPanel.classList.remove('wrong-glow');
        leftPanel.classList.add('correct-glow');
        feedbackEl.textContent = `Great tiles! But x ≠ ${xAnswer}. Try solving again!`;
        feedbackEl.className = 'wrong';
        playErrorSound();
        flashRed();
        streak = 0;
        document.getElementById('streak-val').textContent = streak;
    } else {
        // Both wrong
        leftPanel.classList.add('wrong-glow');
        feedbackEl.textContent = `Not quite! Check your tile placement and the value of x.`;
        feedbackEl.className = 'wrong';
        playErrorSound();
        flashRed();
        streak = 0;
        document.getElementById('streak-val').textContent = streak;
    }
}

function clearFeedback() {
    const el = document.getElementById('feedback-msg');
    el.textContent = '';
    el.className = '';
    document.getElementById('left-panel').classList.remove('correct-glow', 'wrong-glow');
    document.getElementById('right-panel').classList.remove('correct-glow');
}

// ---------- Hurray ----------
function showHurray(x) {
    const overlay = document.getElementById('hurray-overlay');
    const emojis = ['🎉','⭐','🏆','🧮','✨','🎯'];
    document.getElementById('hurray-emoji').textContent = emojis[Math.floor(Math.random() * emojis.length)];
    document.getElementById('hurray-sub').textContent = `x = ${x} ✓  Perfect tiles and answer!`;
    document.getElementById('hurray-pts').textContent = `+${currentEq.points} points`;
    overlay.classList.add('show');

    if (window.confetti) {
        confetti({ particleCount: 130, spread: 80, origin: { y: 0.5 }, colors: ['#fbbf24','#34d399','#c084fc','#60a5fa'] });
    }

    setTimeout(() => {
        overlay.classList.remove('show');
        clearFeedback();
        loadEquation();
    }, 2500);
}

function flashRed() {
    const el = document.getElementById('wrong-flash');
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 300);
}

// ---------- Audio ----------
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();

function playTone(freq, type, duration, vol) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}

function playSuccessSound() {
    [523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f,'sine',0.3,0.12), i*80));
}

function playErrorSound() {
    playTone(200, 'sawtooth', 0.3, 0.08);
    setTimeout(() => playTone(160, 'sawtooth', 0.3, 0.08), 120);
}

// ---------- Start ----------
init();
