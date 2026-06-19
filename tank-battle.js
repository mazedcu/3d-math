const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width, height;
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

// UI Elements
const uiTarget = document.getElementById('ui-target');
const uiScore = document.getElementById('ui-score');
const uiHealth = document.getElementById('player-health-bar');
const notifyEl = document.getElementById('notify');
const notifyText = document.getElementById('notify-text');
const notifySubtext = document.getElementById('notify-subtext');

// Game State
let gameState = 'playing';
let score = 0;
let playerHealth = 100;
let currentTarget = 12;
let factors = [];

function getFactors(n) {
    let f = [];
    for(let i=1; i<=n; i++) {
        if(n % i === 0) f.push(i);
    }
    return f;
}

function newRound() {
    // Pick a random number with decent amount of factors
    const options = [12, 18, 20, 24, 30, 36, 40, 48];
    currentTarget = options[Math.floor(Math.random() * options.length)];
    factors = getFactors(currentTarget);
    uiTarget.innerText = currentTarget;
}

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

function playShoot() { playTone(300, 'square', 0.1, 0.1); }
function playExplosion() { playTone(100, 'sawtooth', 0.4, 0.2); }
function playError() { playTone(150, 'sawtooth', 0.3, 0.1); }

// Mouse Tracking
const mouse = { x: width/2, y: height/2 };
window.addEventListener('pointermove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

// Player Tank
const player = {
    x: width / 2,
    y: height / 2,
    radius: 20,
    angle: 0,
    speed: 3
};

// Entities
let projectiles = [];
let enemyProjectiles = [];
let enemies = [];
let particles = [];

// Firing
window.addEventListener('pointerdown', e => {
    if (gameState !== 'playing') return;
    
    playShoot();

    // Recoil effect
    const dx = Math.cos(player.angle);
    const dy = Math.sin(player.angle);
    player.x -= dx * 5;
    player.y -= dy * 5;

    // Shoot projectile
    projectiles.push({
        x: player.x + dx * 30,
        y: player.y + dy * 30,
        vx: dx * 15,
        vy: dy * 15,
        radius: 4,
        life: 100
    });
});

function spawnEnemy() {
    if (gameState !== 'playing') return;

    // Spawn at edge
    let x, y;
    if (Math.random() > 0.5) {
        x = Math.random() > 0.5 ? -30 : width + 30;
        y = Math.random() * height;
    } else {
        x = Math.random() * width;
        y = Math.random() > 0.5 ? -30 : height + 30;
    }

    // Point roughly towards center
    let initialAngle = Math.atan2((height/2) - y, (width/2) - x) + (Math.random() - 0.5);

    // Assign number
    let isFactor = Math.random() > 0.4; // 60% chance to be a factor
    let num;
    if (isFactor) {
        num = factors[Math.floor(Math.random() * factors.length)];
    } else {
        // Random non-factor
        do {
            num = Math.floor(Math.random() * (currentTarget + 10)) + 1;
        } while (factors.includes(num));
    }

    enemies.push({
        x: x,
        y: y,
        radius: 25,
        number: num,
        isFactor: isFactor,
        speed: 1 + Math.random() * 1.5,
        angle: initialAngle
    });
}

setInterval(spawnEnemy, 1500);

function createExplosion(x, y, color) {
    for(let i=0; i<15; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = Math.random() * 5 + 2;
        particles.push({
            x: x, y: y,
            vx: Math.cos(a)*v, vy: Math.sin(a)*v,
            life: 30 + Math.random()*20,
            maxLife: 50,
            color: color
        });
    }
}

function update() {
    if (gameState !== 'playing') return;

    // Player moves towards mouse
    const dx = mouse.x - player.x;
    const dy = mouse.y - player.y;
    const dist = Math.hypot(dx, dy);
    
    // Only update angle if moving significantly
    if (dist > 2) {
        player.angle = Math.atan2(dy, dx);
    }

    // Smooth lerp to mouse
    player.x += dx * 0.15;
    player.y += dy * 0.15;

    // Keep player in bounds
    player.x = Math.max(player.radius, Math.min(width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(height - player.radius, player.y));

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        
        if (p.life <= 0 || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
            projectiles.splice(i, 1);
            continue;
        }

        // Check collision with enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            const dist = Math.hypot(p.x - e.x, p.y - e.y);
            if (dist < e.radius + p.radius) {
                // Hit!
                projectiles.splice(i, 1);
                
                if (e.isFactor) {
                    // Good hit
                    score += 10;
                    uiScore.innerText = score;
                    playExplosion();
                    createExplosion(e.x, e.y, '#10b981');
                    enemies.splice(j, 1);
                } else {
                    // Bad hit - provoke them!
                    score = Math.max(0, score - 5);
                    uiScore.innerText = score;
                    playError();
                    createExplosion(e.x, e.y, '#ef4444');
                    // Enemy gets angry
                    if (!e.angry) {
                        e.angry = true;
                        e.speed += 1;
                        e.shootTimer = 30; // Starts shooting soon
                    }
                }
                break;
            }
        }
    }

    // Update enemy projectiles
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        let p = enemyProjectiles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        
        if (p.life <= 0 || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
            enemyProjectiles.splice(i, 1);
            continue;
        }

        // Check collision with player
        const dist = Math.hypot(p.x - player.x, p.y - player.y);
        if (dist < p.radius + player.radius) {
            enemyProjectiles.splice(i, 1);
            playerHealth -= 5;
            uiHealth.style.width = Math.max(0, playerHealth) + '%';
            document.body.classList.add('flash-red');
            setTimeout(() => document.body.classList.remove('flash-red'), 200);
            playExplosion();
            if (playerHealth <= 0) endGame();
        }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        
        if (e.angry) {
            // Angry tanks home in on player
            const edx = player.x - e.x;
            const edy = player.y - e.y;
            e.angle = Math.atan2(edy, edx);

            // Angry tanks shoot
            e.shootTimer = (e.shootTimer || 0) - 1;
            if (e.shootTimer <= 0) {
                e.shootTimer = 80; // Shoot every ~1.3 seconds
                enemyProjectiles.push({
                    x: e.x + Math.cos(e.angle) * e.radius,
                    y: e.y + Math.sin(e.angle) * e.radius,
                    vx: Math.cos(e.angle) * 7,
                    vy: Math.sin(e.angle) * 7,
                    radius: 4,
                    life: 150
                });
                playShoot();
            }
        }
        
        e.x += Math.cos(e.angle) * e.speed;
        e.y += Math.sin(e.angle) * e.speed;

        // Cleanup if they wander too far off screen
        if (!e.angry && (e.x < -100 || e.x > width + 100 || e.y < -100 || e.y > height + 100)) {
            enemies.splice(i, 1);
            continue;
        }

        // Collision with player
        const edx = player.x - e.x;
        const edy = player.y - e.y;
        if (Math.hypot(edx, edy) < e.radius + player.radius) {
            // ANY collision hurts player
            playerHealth -= 10;
            uiHealth.style.width = Math.max(0, playerHealth) + '%';
            document.body.classList.add('flash-red');
            setTimeout(() => document.body.classList.remove('flash-red'), 200);
            playExplosion();
            createExplosion(player.x, player.y, '#f59e0b');
            
            enemies.splice(i, 1);

            if (playerHealth <= 0) {
                endGame();
            }
        }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if(p.life <= 0) particles.splice(i, 1);
    }
}

function draw() {
    ctx.clearRect(0, 0, width, height);

    // Draw Grid (optional, makes it look cool)
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    const offsetX = (player.x * -0.2) % gridSize;
    const offsetY = (player.y * -0.2) % gridSize;
    
    ctx.beginPath();
    for(let x=offsetX; x<width; x+=gridSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, height);
    }
    for(let y=offsetY; y<height; y+=gridSize) {
        ctx.moveTo(0, y); ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Draw Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw Projectiles
    ctx.fillStyle = '#fbbf24';
    projectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fbbf24';
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Draw Enemy Projectiles
    ctx.fillStyle = '#ef4444';
    enemyProjectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ef4444';
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Draw Enemies
    enemies.forEach(e => {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);

        // Hull
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-15, -15, 30, 30);
        
        // Tracks
        ctx.fillStyle = '#111';
        ctx.fillRect(-20, -20, 40, 5);
        ctx.fillRect(-20, 15, 40, 5);

        // Turret
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI*2);
        ctx.fill();
        ctx.fillRect(0, -3, 20, 6); // barrel

        ctx.restore();

        // Draw Number (always upright)
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#000';
        ctx.fillText(e.number, e.x, e.y - 25);
        ctx.shadowBlur = 0;
    });

    // Draw Player
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Hull
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(-15, -15, 30, 30);
    
    // Tracks
    ctx.fillStyle = '#111';
    ctx.fillRect(-20, -20, 40, 5);
    ctx.fillRect(-20, 15, 40, 5);

    // Turret
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI*2);
    ctx.fill();
    ctx.fillRect(0, -4, 25, 8); // barrel

    ctx.restore();

    // Draw Target Number on player
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#000';
    ctx.fillText(currentTarget, player.x, player.y - 25);
    ctx.shadowBlur = 0;
}

function gameLoop() {
    update();
    draw();
    if (gameState === 'playing') {
        requestAnimationFrame(gameLoop);
    }
}

function endGame() {
    gameState = 'ended';
    notifyEl.classList.add('show');
    notifySubtext.innerText = `You scored ${score} points!`;
}

// Start
newRound();
gameLoop();

// Change target number every 15 seconds to keep it fresh
setInterval(() => {
    if(gameState === 'playing') {
        newRound();
        
        // Optional: show a mini toast/text on screen "New Number!"
        const toast = document.createElement('div');
        toast.innerText = "New Number!";
        toast.style.position = 'absolute';
        toast.style.top = '100px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.color = '#3b82f6';
        toast.style.fontWeight = 'bold';
        toast.style.fontSize = '2rem';
        toast.style.textShadow = '0 2px 10px rgba(0,0,0,0.5)';
        toast.style.transition = 'opacity 1s';
        document.body.appendChild(toast);
        
        setTimeout(() => toast.style.opacity = '0', 1000);
        setTimeout(() => toast.remove(), 2000);
    }
}, 15000);
