// ============================================================
//  Fraction Cake — Pre-cut options + select mechanic
//  Player picks how many slices to cut (2–12),
//  then clicks slices to select, and gives to the boy.
// ============================================================

const cakeSvg      = document.getElementById('cake-svg');
const cutOptionsEl = document.getElementById('cut-options');
const btnGive      = document.getElementById('btn-give');
const selFracEl    = document.getElementById('sel-frac');
const targetFracEl = document.getElementById('target-frac');
const scoreEl      = document.getElementById('score');
const boyContainer = document.getElementById('boy-container');
const feedbackOvl  = document.getElementById('feedback-overlay');
const feedbackTxt  = document.getElementById('feedback-text');

// -------- State --------
let totalSlices    = 0;      // 0 = uncut (whole cake)
let selectedSlices = new Set();
let score          = 0;
let target         = null;
let isChecking     = false;

// -------- Targets --------
const targetFractions = [
    { n: 1, d: 2 }, { n: 1, d: 3 }, { n: 2, d: 3 },
    { n: 1, d: 4 }, { n: 2, d: 4 }, { n: 3, d: 4 },
    { n: 1, d: 5 }, { n: 2, d: 5 }, { n: 3, d: 5 }, { n: 4, d: 5 },
    { n: 1, d: 6 }, { n: 5, d: 6 },
    { n: 1, d: 8 }, { n: 3, d: 8 }, { n: 5, d: 8 }, { n: 7, d: 8 },
];

// -------- Audio --------
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();

function playTone(freq, type, dur, vol = 0.08) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
}

function playCut()     { playTone(800, 'triangle', 0.08, 0.1); setTimeout(() => playTone(1200, 'sine', 0.06, 0.06), 40); }
function playSelect()  { playTone(520, 'sine', 0.1, 0.06); }
function playSuccess() { playTone(400, 'sine', 0.1, 0.1); setTimeout(() => playTone(600, 'sine', 0.1, 0.1), 100); setTimeout(() => playTone(800, 'sine', 0.3, 0.1), 200); }
function playError()   { playTone(200, 'sawtooth', 0.4, 0.08); setTimeout(() => playTone(150, 'sawtooth', 0.4, 0.08), 200); }

// -------- Build cut-option buttons --------
const CUT_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12];

CUT_OPTIONS.forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'cut-btn';
    btn.textContent = `${n} parts`;
    btn.dataset.parts = n;
    btn.addEventListener('click', () => {
        if (isChecking) return;
        setCut(n);
        playCut();
    });
    cutOptionsEl.appendChild(btn);
});

function setCut(n) {
    totalSlices = n;
    selectedSlices.clear();

    // Highlight active button
    document.querySelectorAll('.cut-btn').forEach(b => {
        b.classList.toggle('active', Number(b.dataset.parts) === n);
    });

    renderCake();
    updateSelectionHUD();
}

// -------- Rendering --------
const TWO_PI = Math.PI * 2;

function polarToXY(angle, r) {
    const a = angle - Math.PI / 2;        // 0 = top
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

function renderCake() {
    cakeSvg.innerHTML = '';
    const R = 1;

    // Cake background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('cx', '0'); bg.setAttribute('cy', '0'); bg.setAttribute('r', String(R));
    bg.setAttribute('class', 'cake-base');
    cakeSvg.appendChild(bg);

    // Frosting dots pattern
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const pat  = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pat.setAttribute('id', 'frost'); pat.setAttribute('width', '0.15'); pat.setAttribute('height', '0.15');
    pat.setAttribute('patternUnits', 'userSpaceOnUse');
    const d = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    d.setAttribute('cx', '0.075'); d.setAttribute('cy', '0.075'); d.setAttribute('r', '0.012');
    d.setAttribute('fill', '#fda4af'); d.setAttribute('opacity', '0.25');
    pat.appendChild(d); defs.appendChild(pat); cakeSvg.appendChild(defs);

    const frostCirc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    frostCirc.setAttribute('cx', '0'); frostCirc.setAttribute('cy', '0'); frostCirc.setAttribute('r', String(R));
    frostCirc.setAttribute('fill', 'url(#frost)');
    cakeSvg.appendChild(frostCirc);

    if (totalSlices === 0) {
        // Uncut — show whole cake, not clickable until user picks a cut
        return;
    }

    // Draw slice paths
    const step = TWO_PI / totalSlices;
    for (let i = 0; i < totalSlices; i++) {
        const a1 = i * step;
        const a2 = (i + 1) * step;
        const p1 = polarToXY(a1, R);
        const p2 = polarToXY(a2, R);
        const large = step > Math.PI ? 1 : 0;

        const pathD = `M 0 0 L ${p1.x} ${p1.y} A ${R} ${R} 0 ${large} 1 ${p2.x} ${p2.y} Z`;
        const path  = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        path.setAttribute('class', 'slice' + (selectedSlices.has(i) ? ' selected' : ''));
        path.addEventListener('click', () => toggleSlice(i));
        cakeSvg.appendChild(path);
    }

    // Draw cut lines from centre to edge
    for (let i = 0; i < totalSlices; i++) {
        const angle = i * step;
        const p = polarToXY(angle, R);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
        line.setAttribute('x2', String(p.x)); line.setAttribute('y2', String(p.y));
        line.setAttribute('class', 'cut-line');
        cakeSvg.appendChild(line);
    }
}

function toggleSlice(i) {
    if (isChecking || totalSlices === 0) return;
    playSelect();
    if (selectedSlices.has(i)) selectedSlices.delete(i);
    else selectedSlices.add(i);
    renderCake();
    updateSelectionHUD();
}

function updateSelectionHUD() {
    const den = totalSlices || 1;
    const num = selectedSlices.size;
    selFracEl.textContent = `${num}/${den}`;
    btnGive.disabled = num === 0;
}

// -------- Give cake --------
btnGive.addEventListener('click', () => {
    if (isChecking || selectedSlices.size === 0 || totalSlices === 0) return;

    const givenNum = selectedSlices.size;
    const givenDen = totalSlices;

    // a/b == c/d  ⟹  a·d == b·c
    if (givenNum * target.d === givenDen * target.n) {
        // ✅ Correct
        isChecking = true;
        playSuccess();
        showFeedback('Correct! 🎉', true);
        boyContainer.classList.add('happy');
        score += 10;
        scoreEl.textContent = score;

        setTimeout(() => {
            boyContainer.classList.remove('happy');
            startRound();
        }, 1800);
    } else {
        // ❌ Wrong
        isChecking = true;
        playError();
        const s = simplify(givenNum, givenDen);
        showFeedback(`Oops! You gave ${s.n}/${s.d}`, false);
        boyContainer.classList.add('sad');
        score = Math.max(0, score - 5);
        scoreEl.textContent = score;

        setTimeout(() => {
            boyContainer.classList.remove('sad');
            isChecking = false;
        }, 2200);
    }
});

function simplify(n, d) { const g = gcd(n, d); return { n: n / g, d: d / g }; }
function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }

function showFeedback(text, ok) {
    feedbackTxt.textContent = text;
    feedbackTxt.className = 'feedback-text ' + (ok ? 'correct' : 'wrong');
    feedbackOvl.classList.remove('show');
    void feedbackOvl.offsetWidth;
    feedbackOvl.classList.add('show');
    setTimeout(() => feedbackOvl.classList.remove('show'), 1500);
}

// -------- Round --------
function startRound() {
    isChecking = false;
    boyContainer.className = 'boy-container';

    target = targetFractions[Math.floor(Math.random() * targetFractions.length)];
    targetFracEl.textContent = `${target.n}/${target.d}`;

    totalSlices = 0;
    selectedSlices.clear();
    document.querySelectorAll('.cut-btn').forEach(b => b.classList.remove('active'));
    renderCake();
    updateSelectionHUD();
}

// -------- Init --------
startRound();
