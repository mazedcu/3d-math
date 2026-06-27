// ============================================================
//  Equivalent Fractions — Match the target fraction
//  See the target + its circle, build your own fraction,
//  watch it update live, then slide them together to check.
// ============================================================

const refSvg      = document.getElementById('ref-svg');
const playerSvg   = document.getElementById('player-svg');
const refNumEl    = document.getElementById('ref-num');
const refDenEl    = document.getElementById('ref-den');
const inpNum      = document.getElementById('inp-num');
const inpDen      = document.getElementById('inp-den');
const btnCheck    = document.getElementById('btn-check');
const scoreEl     = document.getElementById('score');
const streakEl    = document.getElementById('streak');
const cardRef     = document.getElementById('card-ref');
const cardPlayer  = document.getElementById('card-player');
const feedbackBnr = document.getElementById('feedback-banner');
const feedbackIn  = document.getElementById('feedback-inner');
const confettiCvs = document.getElementById('confetti-canvas');

// -------- State --------
let target = { n: 1, d: 2 };
let score  = 0;
let streak = 0;
let isChecking = false;

// -------- Target pool --------
const TARGETS = [
    { n: 1, d: 2 }, { n: 1, d: 3 }, { n: 2, d: 3 },
    { n: 1, d: 4 }, { n: 3, d: 4 }, { n: 1, d: 5 },
    { n: 2, d: 5 }, { n: 3, d: 5 }, { n: 4, d: 5 },
    { n: 1, d: 6 }, { n: 5, d: 6 }, { n: 2, d: 7 },
    { n: 3, d: 7 }, { n: 1, d: 8 }, { n: 3, d: 8 },
    { n: 5, d: 8 }, { n: 7, d: 8 }, { n: 1, d: 9 },
    { n: 2, d: 9 }, { n: 4, d: 9 },
    { n: 1, d: 10 }, { n: 3, d: 10 }, { n: 7, d: 10 },
];

// -------- Audio --------
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();

function tone(freq, type, dur, vol = 0.07) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
}
function playType()  { tone(600, 'sine', 0.06, 0.04); }
function playYay()   { tone(523, 'sine', 0.12, 0.1); setTimeout(() => tone(659, 'sine', 0.12, 0.1), 110); setTimeout(() => tone(784, 'sine', 0.25, 0.1), 220); setTimeout(() => tone(1047, 'sine', 0.35, 0.12), 340); }
function playNope()  { tone(250, 'sawtooth', 0.35, 0.07); setTimeout(() => tone(190, 'sawtooth', 0.35, 0.07), 180); }

// -------- Circle rendering --------
const TWO_PI = Math.PI * 2;

function polarXY(angle, r) {
    const a = angle - Math.PI / 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

/**
 * Draw a fraction circle into an SVG.
 * @param {SVGElement} svg
 * @param {number} num  - numerator (shaded slices)
 * @param {number} den  - denominator (total slices)
 * @param {string} cls  - 'ref' | 'player' for class prefix
 */
function drawCircle(svg, num, den, cls) {
    svg.innerHTML = '';
    const R = 1;

    // Background
    const bg = ns('circle');
    bg.setAttribute('cx', '0'); bg.setAttribute('cy', '0'); bg.setAttribute('r', String(R));
    bg.setAttribute('class', 'cake-bg');
    svg.appendChild(bg);

    if (den <= 0) return;

    const safeNum = Math.max(0, Math.min(num, den));
    const step = TWO_PI / den;

    // Shaded slices
    for (let i = 0; i < safeNum; i++) {
        const a1 = i * step;
        const a2 = (i + 1) * step;
        svg.appendChild(slicePath(a1, a2, R, `${cls}-slice`));
    }

    // Cut lines
    for (let i = 0; i < den; i++) {
        const a = i * step;
        const p = polarXY(a, R);
        const ln = ns('line');
        ln.setAttribute('x1', '0'); ln.setAttribute('y1', '0');
        ln.setAttribute('x2', String(p.x)); ln.setAttribute('y2', String(p.y));
        ln.setAttribute('class', `${cls}-cut`);
        svg.appendChild(ln);
    }
}

function slicePath(a1, a2, R, cls) {
    const p1 = polarXY(a1, R);
    const p2 = polarXY(a2, R);
    const span = a2 - a1;
    const large = span > Math.PI ? 1 : 0;
    const d = `M 0 0 L ${p1.x} ${p1.y} A ${R} ${R} 0 ${large} 1 ${p2.x} ${p2.y} Z`;
    const path = ns('path');
    path.setAttribute('d', d);
    path.setAttribute('class', cls);
    return path;
}

function ns(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

// -------- Player input → live visual --------
inpNum.addEventListener('input', onPlayerInput);
inpDen.addEventListener('input', onPlayerInput);

function onPlayerInput() {
    playType();
    const n = parseInt(inpNum.value) || 0;
    const d = parseInt(inpDen.value) || 0;

    if (d > 0 && n >= 0 && n <= d) {
        drawCircle(playerSvg, n, d, 'player');
        btnCheck.disabled = false;
    } else if (d > 0 && n > d) {
        // improper — still show but cap visual
        drawCircle(playerSvg, d, d, 'player');
        btnCheck.disabled = false;
    } else {
        drawCircle(playerSvg, 0, 0, 'player');
        btnCheck.disabled = true;
    }
}

// -------- Check button --------
btnCheck.addEventListener('click', () => {
    if (isChecking) return;
    const pn = parseInt(inpNum.value) || 0;
    const pd = parseInt(inpDen.value) || 0;
    if (pd <= 0) return;

    // Must not be the exact same fraction written the same way
    const isSameWritten = (pn === target.n && pd === target.d);

    // Equivalent check:  a/b == c/d  ⟹  a·d == b·c
    const isEquiv = (pn * target.d === pd * target.n) && pn > 0;

    // Must be equivalent but NOT the same written form
    if (isEquiv && !isSameWritten) {
        handleCorrect(pn, pd);
    } else if (isSameWritten) {
        handleSameWritten();
    } else {
        handleWrong();
    }
});

// -------- Correct --------
function handleCorrect(pn, pd) {
    isChecking = true;
    btnCheck.disabled = true;

    // Slide cards together
    cardRef.classList.add('slide-in-left');
    cardPlayer.classList.add('slide-in-right');

    setTimeout(() => {
        // Matched glow
        cardRef.classList.add('matched');
        cardPlayer.classList.add('matched');
        playYay();
        showFeedback('YAY! 🎉', 'yay');
        launchConfetti();

        score += 10 + streak * 2;
        streak++;
        scoreEl.textContent = score;
        streakEl.textContent = streak;
    }, 700);

    setTimeout(() => {
        // Reset animations
        cardRef.classList.remove('slide-in-left', 'matched');
        cardPlayer.classList.remove('slide-in-right', 'matched');
        startRound();
    }, 2400);
}

// -------- Same fraction written same way --------
function handleSameWritten() {
    isChecking = true;
    btnCheck.disabled = true;

    cardPlayer.classList.add('wrong-shake');
    showFeedback('Same fraction! Try a different form', 'nope');
    tone(350, 'triangle', 0.3, 0.06);

    setTimeout(() => {
        cardPlayer.classList.remove('wrong-shake');
        isChecking = false;
        btnCheck.disabled = false;
    }, 1200);
}

// -------- Wrong --------
function handleWrong() {
    isChecking = true;
    btnCheck.disabled = true;

    // Slide together
    cardRef.classList.add('slide-in-left');
    cardPlayer.classList.add('slide-in-right');

    setTimeout(() => {
        // Bounce apart
        cardRef.classList.remove('slide-in-left');
        cardPlayer.classList.remove('slide-in-right');
        cardRef.classList.add('bounce-back-left');
        cardPlayer.classList.add('bounce-back-right');
        playNope();
        showFeedback('Not equal! ✖', 'nope');

        streak = 0;
        streakEl.textContent = streak;
        score = Math.max(0, score - 3);
        scoreEl.textContent = score;
    }, 700);

    setTimeout(() => {
        cardRef.classList.remove('bounce-back-left');
        cardPlayer.classList.remove('bounce-back-right');
        isChecking = false;
        btnCheck.disabled = false;
    }, 1800);
}

// -------- Feedback --------
function showFeedback(text, type) {
    feedbackIn.textContent = text;
    feedbackIn.className = 'feedback-inner ' + type;
    feedbackBnr.classList.remove('show');
    void feedbackBnr.offsetWidth;
    feedbackBnr.classList.add('show');
    setTimeout(() => feedbackBnr.classList.remove('show'), 1800);
}

// -------- Confetti --------
function launchConfetti() {
    const ctx = confettiCvs.getContext('2d');
    confettiCvs.width  = window.innerWidth;
    confettiCvs.height = window.innerHeight;

    const particles = [];
    const COLORS = ['#a78bfa','#22d3ee','#f472b6','#34d399','#fbbf24','#f43f5e','#818cf8'];

    for (let i = 0; i < 100; i++) {
        particles.push({
            x: confettiCvs.width / 2 + (Math.random() - 0.5) * 200,
            y: confettiCvs.height / 2,
            vx: (Math.random() - 0.5) * 14,
            vy: -Math.random() * 16 - 4,
            w: Math.random() * 8 + 4,
            h: Math.random() * 6 + 2,
            rot: Math.random() * 360,
            rv: (Math.random() - 0.5) * 12,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            life: 1
        });
    }

    let frame;
    function animate() {
        ctx.clearRect(0, 0, confettiCvs.width, confettiCvs.height);
        let alive = false;
        particles.forEach(p => {
            if (p.life <= 0) return;
            alive = true;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.35;
            p.rot += p.rv;
            p.life -= 0.012;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot * Math.PI / 180);
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        });
        if (alive) frame = requestAnimationFrame(animate);
        else ctx.clearRect(0, 0, confettiCvs.width, confettiCvs.height);
    }
    animate();
}

// -------- Round --------
function startRound() {
    isChecking = false;

    // Pick random target (avoid repeating last one)
    let next;
    do {
        next = TARGETS[Math.floor(Math.random() * TARGETS.length)];
    } while (next.n === target.n && next.d === target.d && TARGETS.length > 1);
    target = next;

    // Show target
    refNumEl.textContent = target.n;
    refDenEl.textContent = target.d;
    drawCircle(refSvg, target.n, target.d, 'ref');

    // Reset player
    inpNum.value = '';
    inpDen.value = '';
    drawCircle(playerSvg, 0, 0, 'player');
    btnCheck.disabled = true;

    inpNum.focus();
}

// -------- Init --------
startRound();
