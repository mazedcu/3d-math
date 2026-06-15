// ============================================================
//  Angle Cannon — estimate the launch angle, throw the ball.
//  Pure 2D canvas. Uses shared.css HUD/overlay components.
// ============================================================

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// UI
const uiScore = document.getElementById('s-score');
const uiRound = document.getElementById('s-round');
const uiBest = document.getElementById('s-best');
const uiTargetAngle = document.getElementById('target-angle');
const uiOverlay = document.getElementById('start-overlay');
const uiBtnStart = document.getElementById('btn-start');
const uiBtnLaunch = document.getElementById('btn-launch');
const uiTitle = document.getElementById('game-end-title');
const uiDesc = document.getElementById('game-end-desc');
const uiHint = document.getElementById('hint');

// World / physics (recomputed on resize)
let W = 0, H = 0;
let pivot = { x: 0, y: 0 };
let groundY = 0;
let barrelLen = 90;
let SPEED = 1000;     // launch speed (px/s)
const GRAV = 1600;    // gravity (px/s^2)

// State
const MAX_ROUNDS = 10;
let score = 0;
let round = 0;
let best = parseInt(localStorage.getItem('cannon_best') || '0', 10);

const PHASE = { READY: 'ready', AIM: 'aim', FLYING: 'flying', RESULT: 'result' };
let phase = PHASE.READY;

let targetDeg = 45;          // angle the player must match
let playerRad = Math.PI / 4; // current barrel angle (radians from horizontal)
let pointer = { x: 0, y: 0, has: false };

let ball = null;             // { x, y, vx, vy }
let trail = [];
let resultInfo = null;       // { playerDeg, targetDeg, diff, gained, msg, color }
let resultTimer = 0;

uiBest.innerText = best;

// ---------------- Setup ----------------
function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    pivot = { x: W * 0.15, y: H * 0.80 };
    groundY = pivot.y;
    barrelLen = Math.max(70, Math.min(W, H) * 0.13);
    // Tune speed so a 45° shot lands around 70% of the screen width.
    const range45 = W * 0.72;
    SPEED = Math.sqrt(GRAV * range45);
}
resize();
window.addEventListener('resize', resize);

function clampAngle(rad) {
    const min = 5 * Math.PI / 180;
    const max = 85 * Math.PI / 180;
    return Math.max(min, Math.min(max, rad));
}

function setAngleFromPointer(clientX, clientY) {
    pointer.x = clientX;
    pointer.y = clientY;
    pointer.has = true;
    const dx = clientX - pivot.x;
    const dy = pivot.y - clientY; // up is positive
    let a = Math.atan2(dy, Math.max(20, dx));
    playerRad = clampAngle(a);
}

// ---------------- Input ----------------
window.addEventListener('mousemove', (e) => {
    if (phase === PHASE.AIM) setAngleFromPointer(e.clientX, e.clientY);
});
canvas.addEventListener('mousedown', () => {
    if (phase === PHASE.AIM) launch();   // desktop: click to throw
});
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (phase === PHASE.AIM && e.touches.length) setAngleFromPointer(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (phase === PHASE.AIM && e.touches.length) setAngleFromPointer(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (phase === PHASE.AIM) launch();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (phase === PHASE.AIM) playerRad = clampAngle(playerRad + 1 * Math.PI / 180);
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (phase === PHASE.AIM) playerRad = clampAngle(playerRad - 1 * Math.PI / 180);
    }
});

uiBtnLaunch.addEventListener('click', () => { if (phase === PHASE.AIM) launch(); });
uiBtnStart.addEventListener('click', startGame);

// ---------------- Game flow ----------------
function startGame() {
    uiOverlay.classList.remove('visible');
    score = 0;
    round = 0;
    uiScore.innerText = 0;
    nextRound();
}

function nextRound() {
    if (round >= MAX_ROUNDS) { endGame(); return; }
    round++;
    uiRound.innerText = round + '/' + MAX_ROUNDS;
    targetDeg = Math.floor(Math.random() * 66) + 15; // 15..80
    uiTargetAngle.innerText = targetDeg;
    // Start the player somewhere away from the answer so they must estimate.
    playerRad = clampAngle((Math.random() * 50 + 20) * Math.PI / 180);
    ball = null;
    trail = [];
    resultInfo = null;
    phase = PHASE.AIM;
}

function launch() {
    phase = PHASE.FLYING;
    const tip = barrelTip();
    ball = {
        x: tip.x,
        y: tip.y,
        vx: SPEED * Math.cos(playerRad),
        vy: -SPEED * Math.sin(playerRad),
    };
    trail = [];
}

function scoreThrow() {
    const playerDeg = playerRad * 180 / Math.PI;
    const diff = Math.abs(playerDeg - targetDeg);
    let gained, msg, color;
    if (diff <= 1.5)      { gained = 20; msg = 'PERFECT! 🎯'; color = '#fbbf24'; }
    else if (diff <= 4)   { gained = 12; msg = 'Great!';       color = '#34d399'; }
    else if (diff <= 8)   { gained = 6;  msg = 'Good';         color = '#60a5fa'; }
    else if (diff <= 15)  { gained = 2;  msg = 'Close';        color = '#f59e0b'; }
    else                  { gained = 0;  msg = 'Way off!';     color = '#ef4444'; }

    score += gained;
    uiScore.innerText = score;
    resultInfo = { playerDeg, diff, gained, msg, color };
    showNotification((gained > 0 ? '+' + gained + '  ' : '') + msg, color);

    if (score > best) {
        best = score;
        localStorage.setItem('cannon_best', String(best));
        uiBest.innerText = best;
    }
}

function endGame() {
    phase = PHASE.READY;
    const pct = Math.round((score / (MAX_ROUNDS * 20)) * 100);
    let title;
    if (pct >= 85) title = 'Sharpshooter! 🏆';
    else if (pct >= 60) title = 'Nice aim! 🎯';
    else if (pct >= 35) title = 'Keep practising! 💪';
    else title = 'Try again!';
    uiTitle.innerText = title;
    uiDesc.innerHTML = `You scored <strong style="color:#f59e0b">${score}</strong> out of ${MAX_ROUNDS * 20}.<br><br>Aim the cannon to match each requested angle and launch!`;
    uiBtnStart.innerText = 'PLAY AGAIN';
    uiOverlay.classList.add('visible');
}

function showNotification(msg, color) {
    const notify = document.getElementById('notify');
    const notifyText = document.getElementById('notify-text');
    notifyText.innerText = msg;
    if (color) notifyText.style.color = color;
    notify.classList.remove('show');
    void notify.offsetWidth;
    notify.classList.add('show');
}

// ---------------- Geometry helpers ----------------
function barrelTip() {
    return {
        x: pivot.x + Math.cos(playerRad) * barrelLen,
        y: pivot.y - Math.sin(playerRad) * barrelLen,
    };
}

// Landing x for a given launch angle (flat ground), same speed/gravity.
function landingX(rad) {
    return pivot.x + (SPEED * SPEED * Math.sin(2 * rad)) / GRAV;
}

// ---------------- Rendering ----------------
function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1e3a8a');
    sky.addColorStop(0.6, '#2563eb');
    sky.addColorStop(1, '#60a5fa');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Ground
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, groundY, W, 6);
}

function drawProtractor() {
    const r = barrelLen * 1.45;
    ctx.save();
    ctx.translate(pivot.x, pivot.y);

    // arc
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ticks + labels
    ctx.font = '600 13px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let deg = 0; deg <= 90; deg += 15) {
        const a = deg * Math.PI / 180;
        const cos = Math.cos(a), sin = Math.sin(a);
        const major = deg % 30 === 0;
        const inner = major ? r - 16 : r - 9;
        ctx.beginPath();
        ctx.moveTo(cos * inner, -sin * inner);
        ctx.lineTo(cos * r, -sin * r);
        ctx.strokeStyle = major ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)';
        ctx.lineWidth = major ? 2 : 1;
        ctx.stroke();
        if (major) {
            const lr = r + 16;
            ctx.fillText(deg + '\u00B0', cos * lr, -sin * lr);
        }
    }
    ctx.restore();
}

function drawTargetMarker() {
    // Show the ideal landing ring only after the throw, as feedback.
    if (phase !== PHASE.RESULT) return;
    const tx = landingX(targetDeg * Math.PI / 180);
    ctx.save();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.ellipse(tx, groundY, 26, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fbbf24';
    ctx.font = '700 13px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('target ' + targetDeg + '\u00B0', tx, groundY - 18);
    ctx.restore();
}

function drawCannon() {
    ctx.save();
    ctx.translate(pivot.x, pivot.y);

    // Barrel
    ctx.save();
    ctx.rotate(-playerRad);
    const grad = ctx.createLinearGradient(0, -11, 0, 11);
    grad.addColorStop(0, '#9ca3af');
    grad.addColorStop(0.5, '#4b5563');
    grad.addColorStop(1, '#1f2937');
    ctx.fillStyle = grad;
    roundRect(ctx, 0, -11, barrelLen, 22, 8);
    ctx.fill();
    // muzzle ring
    ctx.fillStyle = '#111827';
    roundRect(ctx, barrelLen - 8, -13, 8, 26, 4);
    ctx.fill();
    ctx.restore();

    // Wheel / base
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#7c2d12';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#451a03';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();

    ctx.restore();
}

function drawBall() {
    if (!ball) return;
    // trail
    ctx.save();
    for (let i = 0; i < trail.length; i++) {
        const t = trail[i];
        ctx.globalAlpha = (i / trail.length) * 0.5;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fde68a';
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    // ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 2, ball.x, ball.y, 10);
    g.addColorStop(0, '#fff7ed');
    g.addColorStop(1, '#f59e0b');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#b45309';
    ctx.stroke();
    ctx.restore();
}

function drawResultText() {
    if (phase !== PHASE.RESULT || !resultInfo) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '800 28px Outfit, sans-serif';
    ctx.fillStyle = resultInfo.color;
    ctx.fillText(
        `You: ${resultInfo.playerDeg.toFixed(0)}\u00B0   Target: ${targetDeg}\u00B0   (off by ${resultInfo.diff.toFixed(0)}\u00B0)`,
        W / 2, 150
    );
    ctx.restore();
}

function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
}

// ---------------- Loop ----------------
let lastTime = performance.now();
function animate(time) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (time - lastTime) / 1000 || 0);
    lastTime = time;

    // Physics
    if (phase === PHASE.FLYING && ball) {
        ball.vy += GRAV * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > 28) trail.shift();

        if (ball.y >= groundY || ball.x > W + 40) {
            ball.y = Math.min(ball.y, groundY);
            scoreThrow();
            phase = PHASE.RESULT;
            resultTimer = 1.6;
        }
    } else if (phase === PHASE.RESULT) {
        resultTimer -= dt;
        if (resultTimer <= 0) nextRound();
    }

    // Hide hint once the first throw happens
    if (uiHint && round > 1) uiHint.style.display = 'none';

    // Render
    drawBackground();
    drawProtractor();
    drawTargetMarker();
    drawCannon();
    drawBall();
    drawResultText();
}
requestAnimationFrame(animate);
