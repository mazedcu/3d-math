// ================================================
// LCM Frog Jump Game
// Two frogs jump on a number line by different amounts.
// The player must guess where they first land on the same spot (the LCM).
// ================================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let pendingCheck = false;
let userGuess = -1;
let jumpQueue = []; // queued jumps to auto-play

let score = 0;
let round = 1;
let jumpA = 3; // green frog jump size
let jumpB = 4; // red frog jump size
let lcmAnswer = 12;

let frogAPos = 0; // current position on number line
let frogBPos = 0;
let frogATarget = 0; // animation target
let frogBTarget = 0;

let isJumping = false;
let jumpAnimProgress = 1; // 1 = done
const jumpAnimDuration = 600; // ms
let jumpAnimStart = 0;

// Frog visual Y positions (animated for bounce)
let frogAVisualY = 0;
let frogBVisualY = 0;

// Camera scroll offset (to follow frogs)
let cameraX = 0;
let cameraTargetX = 0;

// Splash particles
let particles = [];

// Trail markers
let trailA = [0];
let trailB = [0];

let metAt = -1; // position where they met (-1 = haven't met)
let gameOver = false;
let revealedResult = false;

init();

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function lcm(a, b) { return (a * b) / gcd(a, b); }

function init() {
    resize();
    window.addEventListener('resize', resize);
    
    document.getElementById('btn-check').addEventListener('click', checkAnswer);
    document.getElementById('btn-new').addEventListener('click', newRound);
    document.getElementById('answer-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
    
    newRound();
    requestAnimationFrame(gameLoop);
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function newRound() {
    // Generate two random jump sizes (2-9) that aren't equal
    jumpA = Math.floor(Math.random() * 8) + 2;
    jumpB = Math.floor(Math.random() * 8) + 2;
    while (jumpB === jumpA) {
        jumpB = Math.floor(Math.random() * 8) + 2;
    }
    
    lcmAnswer = lcm(jumpA, jumpB);
    
    frogAPos = 0;
    frogBPos = 0;
    frogATarget = 0;
    frogBTarget = 0;
    frogAVisualY = 0;
    frogBVisualY = 0;
    cameraX = 0;
    cameraTargetX = 0;
    trailA = [0];
    trailB = [0];
    metAt = -1;
    gameOver = false;
    revealedResult = false;
    pendingCheck = false;
    userGuess = -1;
    jumpQueue = [];
    particles = [];
    
    document.getElementById('jump-a').innerText = jumpA;
    document.getElementById('jump-b').innerText = jumpB;
    document.getElementById('answer-input').value = '';
    document.getElementById('answer-input').disabled = false;
    document.getElementById('btn-check').disabled = false;
    document.getElementById('s-round').innerText = round;
}

function doJump() {
    if (isJumping || gameOver) return;
    
    frogATarget = frogAPos + jumpA;
    frogBTarget = frogBPos + jumpB;
    
    isJumping = true;
    jumpAnimProgress = 0;
    jumpAnimStart = performance.now();
}

function buildJumpQueue() {
    // Frogs take turns jumping so they eventually land on the same number (LCM)
    jumpQueue = [];
    let a = 0, b = 0;
    while (a < lcmAnswer || b < lcmAnswer) {
        if (a <= b && a < lcmAnswer) {
            a += jumpA;
        } else if (b < lcmAnswer) {
            b += jumpB;
        }
        jumpQueue.push({ a, b });
        
        // safety cap
        if (jumpQueue.length > 200) break;
    }
}

function startNextQueuedJump() {
    if (jumpQueue.length === 0 || isJumping) return;
    
    const next = jumpQueue.shift();
    frogATarget = next.a;
    frogBTarget = next.b;
    
    isJumping = true;
    jumpAnimProgress = 0;
    jumpAnimStart = performance.now();
}

function checkAnswer() {
    if (pendingCheck || gameOver) return;
    
    const input = parseInt(document.getElementById('answer-input').value, 10);
    if (isNaN(input) || input <= 0) {
        showNotification('Enter a positive number!', '#f59e0b');
        return;
    }
    
    userGuess = input;
    pendingCheck = true;
    document.getElementById('answer-input').disabled = true;
    document.getElementById('btn-check').disabled = true;
    
    showNotification('🐸 Let\'s see where they both land...', '#a78bfa');
    
    // Build full jump queue and start auto-jumping
    // Reset frogs to 0 first
    frogAPos = 0;
    frogBPos = 0;
    frogATarget = 0;
    frogBTarget = 0;
    trailA = [0];
    trailB = [0];
    cameraX = 0;
    cameraTargetX = 0;
    
    buildJumpQueue();
    
    // Start the first jump after a short delay
    setTimeout(() => {
        startNextQueuedJump();
    }, 600);
}

function showNotification(msg, color) {
    const notify = document.getElementById('notify');
    const notifyText = document.getElementById('notify-text');
    notifyText.innerText = msg;
    notifyText.style.color = color;
    notify.classList.remove('show');
    void notify.offsetWidth; // reflow
    notify.classList.add('show');
}

function showHurray() {
    const hurray = document.getElementById('hurray');
    hurray.classList.remove('show');
    void hurray.offsetWidth;
    hurray.classList.add('show');
    setTimeout(() => hurray.classList.remove('show'), 1800);
}

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: -Math.random() * 5 - 2,
            life: 1,
            color,
            size: Math.random() * 4 + 2
        });
    }
}

// ============ GAME LOOP ============

function gameLoop(time) {
    requestAnimationFrame(gameLoop);
    update(time);
    draw();
}

function update(time) {
    // Animate jump
    if (isJumping) {
        const elapsed = time - jumpAnimStart;
        jumpAnimProgress = Math.min(elapsed / jumpAnimDuration, 1);
        
        // Ease: cubic out
        const t = 1 - Math.pow(1 - jumpAnimProgress, 3);
        
        // Parabolic bounce Y (arc) - only bounce if actually jumping
        const bounceA = (frogATarget !== frogAPos) ? Math.sin(t * Math.PI) * 60 : 0;
        const bounceB = (frogBTarget !== frogBPos) ? Math.sin(t * Math.PI) * 60 : 0;
        frogAVisualY = -bounceA;
        frogBVisualY = -bounceB;
        
        if (jumpAnimProgress >= 1) {
            if (frogATarget !== frogAPos) trailA.push(frogATarget);
            if (frogBTarget !== frogBPos) trailB.push(frogBTarget);
            
            frogAPos = frogATarget;
            frogBPos = frogBTarget;
            frogAVisualY = 0;
            frogBVisualY = 0;
            isJumping = false;
            
            // Check if they both landed on the LCM
            if (frogAPos === lcmAnswer && frogBPos === lcmAnswer && metAt === -1) {
                metAt = lcmAnswer;
                gameOver = true;
                
                // Spawn celebration particles
                const meetScreenX = numberLineToScreen(metAt);
                const lineY = canvas.height * 0.6;
                spawnParticles(meetScreenX, lineY, '#facc15', 30);
                spawnParticles(meetScreenX, lineY, '#34d399', 20);
                spawnParticles(meetScreenX, lineY, '#a78bfa', 20);
                
                if (pendingCheck) {
                    pendingCheck = false;
                    if (userGuess === lcmAnswer) {
                        score++;
                        document.getElementById('s-score').innerText = score;
                        showNotification(`🎉 CORRECT! LCM(${jumpA}, ${jumpB}) = ${lcmAnswer}`, '#34d399');
                        showHurray();
                    } else {
                        showNotification(`❌ Wrong! You guessed ${userGuess}, but they first share ${lcmAnswer}.`, '#ef4444');
                    }
                    
                    setTimeout(() => {
                        round++;
                        newRound();
                    }, 3500);
                }
            } else if (jumpQueue.length > 0) {
                // Short pause before next jump
                setTimeout(() => {
                    startNextQueuedJump();
                }, 150);
            }
        }
    }
    
    // Camera follow
    const maxFrog = Math.max(frogAPos, frogBPos, frogATarget, frogBTarget);
    cameraTargetX = Math.max(0, maxFrog - 8);
    cameraX += (cameraTargetX - cameraX) * 0.08;
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.life -= 0.02;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function numberLineToScreen(pos) {
    const unitSize = 60;
    const originX = 120;
    return originX + (pos - cameraX) * unitSize;
}

function draw() {
    const w = canvas.width;
    const h = canvas.height;
    
    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    
    // Stars
    drawStars();
    
    const lineY = h * 0.6;
    const unitSize = 60;
    const originX = 120;
    
    // How many units fit on screen
    const startNum = Math.floor(cameraX) - 2;
    const endNum = Math.ceil(cameraX + w / unitSize) + 2;
    
    // Draw number line
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(w, lineY);
    ctx.stroke();
    
    // Draw tick marks and numbers
    for (let i = Math.max(0, startNum); i <= endNum; i++) {
        const x = numberLineToScreen(i);
        if (x < -50 || x > w + 50) continue;
        
        // Tick mark
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, lineY - 10);
        ctx.lineTo(x, lineY + 10);
        ctx.stroke();
        
        // Number
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = 'bold 14px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(i.toString(), x, lineY + 30);
    }
    
    // Draw trail markers (green frog)
    for (const pos of trailA) {
        const x = numberLineToScreen(pos);
        if (x < -50 || x > w + 50) continue;
        ctx.fillStyle = 'rgba(52, 211, 153, 0.4)';
        ctx.beginPath();
        ctx.arc(x, lineY - 16, 5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw trail markers (red frog)
    for (const pos of trailB) {
        const x = numberLineToScreen(pos);
        if (x < -50 || x > w + 50) continue;
        ctx.fillStyle = 'rgba(248, 113, 113, 0.4)';
        ctx.beginPath();
        ctx.arc(x, lineY + 16, 5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Meeting point marker
    if (metAt >= 0) {
        const mx = numberLineToScreen(metAt);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(mx, lineY, 20, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 16px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`LCM = ${metAt}`, mx, lineY + 55);
    }
    
    // Draw frogs
    drawFrog(lineY, true);  // green frog (A) above line
    drawFrog(lineY, false); // red frog (B) below line
    
    // Draw particles
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

let starPositions = null;
function drawStars() {
    if (!starPositions) {
        starPositions = [];
        for (let i = 0; i < 120; i++) {
            starPositions.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height * 0.5,
                s: Math.random() * 1.5 + 0.5,
                b: Math.random()
            });
        }
    }
    for (const star of starPositions) {
        const flicker = 0.5 + Math.sin(performance.now() * 0.002 + star.b * 100) * 0.3;
        ctx.fillStyle = `rgba(255,255,255,${flicker})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.s, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawFrog(lineY, isGreen) {
    const pos = isGreen ? frogAPos : frogBPos;
    const target = isGreen ? frogATarget : frogBTarget;
    const visualY = isGreen ? frogAVisualY : frogBVisualY;
    const color = isGreen ? '#34d399' : '#f87171';
    const darkColor = isGreen ? '#059669' : '#dc2626';
    const yOffset = isGreen ? -40 : 40;
    
    let currentX;
    if (isJumping) {
        const t = 1 - Math.pow(1 - jumpAnimProgress, 3);
        currentX = pos + (target - pos) * t;
    } else {
        currentX = pos;
    }
    
    const screenX = numberLineToScreen(currentX);
    const screenY = lineY + yOffset + visualY;
    
    const frogSize = 20;
    
    // Body (ellipse)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY, frogSize, frogSize * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Darker belly
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 4, frogSize * 0.7, frogSize * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(screenX - 8, screenY - 10, 6, 0, Math.PI * 2);
    ctx.arc(screenX + 8, screenY - 10, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupils
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(screenX - 7, screenY - 10, 3, 0, Math.PI * 2);
    ctx.arc(screenX + 9, screenY - 10, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Frog emoji label
    ctx.font = '24px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐸', screenX, screenY - 24);
    
    // Current position label
    ctx.fillStyle = color;
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const labelY = isGreen ? screenY - 42 : screenY + 38;
    ctx.fillText(pos.toString(), screenX, labelY);
}
