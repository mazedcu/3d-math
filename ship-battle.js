const SIZES = [
    { name: 'small', px: 30 },
    { name: 'medium', px: 50 },
    { name: 'large', px: 70 }
];

let playerHealth = 100;
let enemyHealth = 100;
let gameState = 'playing'; // playing, ended

const container = document.getElementById('game-container');
const cannonsContainer = document.getElementById('cannons-container');
const spawnArea = document.getElementById('spawn-area');
const ball = document.getElementById('cannonball');
const uiPlayerHealth = document.getElementById('player-health-bar');
const uiEnemyHealth = document.getElementById('enemy-health-bar');
const enemyShip = document.getElementById('enemy-ship');
const playerShip = document.getElementById('player-ship');

let cannonsData = [];
let currentBallSize = null;

// Audio
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

function playFire() {
    playTone(150, 'square', 0.2, 0.2);
    setTimeout(() => playTone(100, 'sawtooth', 0.3, 0.2), 50);
}

function playHit() {
    playTone(80, 'sawtooth', 0.4, 0.3);
}

function playError() {
    playTone(200, 'sawtooth', 0.3, 0.1);
}

function init() {
    createCannons();
    spawnNewBall();
    setupDrag();
    startEnemyAI();
}

function createCannons() {
    cannonsContainer.innerHTML = '';
    cannonsData = [];
    
    // Shuffle sizes so they appear in random order
    let shuffledSizes = [...SIZES].sort(() => Math.random() - 0.5);

    shuffledSizes.forEach((sizeObj, idx) => {
        const cDiv = document.createElement('div');
        cDiv.className = 'cannon';
        
        const holeDiv = document.createElement('div');
        holeDiv.className = `cannon-hole size-${sizeObj.name}`;
        
        cDiv.appendChild(holeDiv);
        cannonsContainer.appendChild(cDiv);
        
        cannonsData.push({
            el: cDiv,
            holeEl: holeDiv,
            size: sizeObj.name,
            px: sizeObj.px
        });
    });
}

function spawnNewBall() {
    // Pick random size from the available ones
    const randSize = SIZES[Math.floor(Math.random() * SIZES.length)];
    currentBallSize = randSize;
    
    ball.className = `cannonball size-${randSize.name}`;
    ball.style.transform = `translate(0px, 0px)`;
    
    // Set explicit width/height inline so dragging calcs work easily if needed
    ball.style.width = `${randSize.px}px`;
    ball.style.height = `${randSize.px}px`;
}

// Drag logic
let isDragging = false;
let startX = 0, startY = 0;
let translateX = 0, translateY = 0;
let currentDropTarget = null;

function setupDrag() {
    ball.addEventListener('pointerdown', e => {
        if (gameState !== 'playing') return;
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        ball.setPointerCapture(e.pointerId);
    });

    ball.addEventListener('pointermove', e => {
        if (!isDragging || gameState !== 'playing') return;
        
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        ball.style.transform = `translate(${translateX}px, ${translateY}px) scale(1.05)`;
        
        checkHover(e.clientX, e.clientY);
    });

    ball.addEventListener('pointerup', e => {
        if (!isDragging || gameState !== 'playing') return;
        isDragging = false;
        ball.releasePointerCapture(e.pointerId);
        
        handleDrop(e.clientX, e.clientY);
    });
}

function checkHover(mouseX, mouseY) {
    let hovered = null;
    cannonsData.forEach(c => {
        const rect = c.holeEl.getBoundingClientRect();
        // Check if mouse is inside cannon hole rect
        if (mouseX >= rect.left && mouseX <= rect.right &&
            mouseY >= rect.top && mouseY <= rect.bottom) {
            hovered = c;
            c.el.classList.add('highlight');
        } else {
            c.el.classList.remove('highlight');
        }
    });
    currentDropTarget = hovered;
}

function handleDrop(mouseX, mouseY) {
    // Clean highlights
    cannonsData.forEach(c => c.el.classList.remove('highlight'));
    
    if (currentDropTarget) {
        if (currentDropTarget.size === currentBallSize.name) {
            // MATCH!
            firePlayerCannon(currentDropTarget);
            return; // don't snap back, wait for new ball
        } else {
            // MISMATCH
            playError();
            document.body.classList.add('flash-red');
            setTimeout(() => document.body.classList.remove('flash-red'), 200);
        }
    }
    
    // Snap back
    translateX = 0;
    translateY = 0;
    ball.style.transform = `translate(0px, 0px)`;
}

function firePlayerCannon(cannonObj) {
    playFire();
    
    // Recoil
    cannonObj.el.classList.add('firing');
    setTimeout(() => cannonObj.el.classList.remove('firing'), 150);

    // Hide ball temporarily
    ball.style.display = 'none';

    // Create projectile
    const rect = cannonObj.holeEl.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    
    const startX = rect.left + rect.width/2 - cRect.left;
    const startY = rect.top - cRect.top;
    
    const proj = document.createElement('div');
    proj.className = 'projectile';
    proj.style.width = `${currentBallSize.px}px`;
    proj.style.height = `${currentBallSize.px}px`;
    proj.style.left = `${startX - currentBallSize.px/2}px`;
    proj.style.top = `${startY}px`;
    container.appendChild(proj);
    
    // Target
    const eRect = enemyShip.getBoundingClientRect();
    const targetX = eRect.left + eRect.width/2 - cRect.left + (Math.random() - 0.5) * 50;
    const targetY = eRect.top + eRect.height/2 - cRect.top;

    animateProjectile(proj, startX, startY, targetX, targetY, true);
    
    setTimeout(() => {
        if(gameState === 'playing') {
            ball.style.display = 'block';
            translateX = 0;
            translateY = 0;
            spawnNewBall();
        }
    }, 500); // Wait half a second before new ball
}

function fireEnemyCannon() {
    if(gameState !== 'playing') return;
    playFire();

    const cRect = container.getBoundingClientRect();
    const eRect = enemyShip.getBoundingClientRect();
    
    const startX = eRect.left + eRect.width/2 - cRect.left;
    const startY = eRect.bottom - cRect.top;
    
    const size = SIZES[Math.floor(Math.random() * SIZES.length)].px;
    const proj = document.createElement('div');
    proj.className = 'projectile';
    proj.style.width = `${size}px`;
    proj.style.height = `${size}px`;
    proj.style.left = `${startX - size/2}px`;
    proj.style.top = `${startY}px`;
    container.appendChild(proj);

    const pRect = playerShip.getBoundingClientRect();
    const targetX = pRect.left + pRect.width/2 - cRect.left + (Math.random() - 0.5) * 100;
    const targetY = pRect.top + 50 - cRect.top; // Hit deck

    animateProjectile(proj, startX, startY, targetX, targetY, false);
}

function animateProjectile(proj, startX, startY, targetX, targetY, isPlayer) {
    const duration = isPlayer ? 400 : 800; // ms (enemy is slower to give panic)
    const startTime = performance.now();

    function step(time) {
        let p = (time - startTime) / duration;
        if (p >= 1) p = 1;

        // Linear interpoation for X and Y
        const currentX = startX + (targetX - startX) * p;
        const currentY = startY + (targetY - startY) * p;
        
        proj.style.transform = `translate(${currentX - startX}px, ${currentY - startY}px)`;

        if (p < 1) {
            requestAnimationFrame(step);
        } else {
            proj.remove();
            createExplosion(targetX, targetY);
            handleImpact(isPlayer);
        }
    }
    requestAnimationFrame(step);
}

function createExplosion(x, y) {
    playHit();
    const expl = document.createElement('div');
    expl.className = 'explosion';
    expl.style.left = `${x}px`;
    expl.style.top = `${y}px`;
    container.appendChild(expl);
    
    setTimeout(() => expl.remove(), 500);
}

function handleImpact(isPlayerHitEnemy) {
    if (gameState !== 'playing') return;

    if (isPlayerHitEnemy) {
        enemyHealth -= 20;
        uiEnemyHealth.style.width = `${Math.max(0, enemyHealth)}%`;
        if (enemyHealth <= 0) endGame(true);
    } else {
        playerHealth -= 15;
        uiPlayerHealth.style.width = `${Math.max(0, playerHealth)}%`;
        document.body.classList.add('flash-red');
        setTimeout(() => document.body.classList.remove('flash-red'), 200);
        if (playerHealth <= 0) endGame(false);
    }
}

function startEnemyAI() {
    function scheduleFire() {
        if(gameState !== 'playing') return;
        const delay = 3000 + Math.random() * 2000; // 3-5 seconds
        setTimeout(() => {
            fireEnemyCannon();
            scheduleFire();
        }, delay);
    }
    scheduleFire();
}

function endGame(playerWon) {
    gameState = 'ended';
    const notifyEl = document.getElementById('notify');
    const notifyText = document.getElementById('notify-text');
    const notifySubtext = document.getElementById('notify-subtext');

    notifyEl.classList.add('show');
    if (playerWon) {
        notifyText.innerText = "VICTORY!";
        notifyText.style.color = "#10b981";
        notifySubtext.innerText = "You sank the enemy ship!";
        if (window.confetti) {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 2000 });
        }
    } else {
        notifyText.innerText = "DEFEAT";
        notifyText.style.color = "#ef4444";
        notifySubtext.innerText = "Your ship was destroyed.";
    }
}

// Start
init();
