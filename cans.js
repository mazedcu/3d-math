const $ = id => document.getElementById(id);
const dom = {
    target: $('s-target'),
    score: $('s-score'),
    lives: $('s-lives'),
    startScreen: $('start-screen'),
    btnStart: $('btn-start'),
    flash: $('flash'),
    gameOver: $('game-over'),
    goDesc: $('go-desc'),
    crosshair: $('crosshair')
};

// ─── AUDIO ─────────────────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration, vol=0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playShoot() {
    playTone(150, 'square', 0.1, 0.2);
    setTimeout(() => playTone(100, 'square', 0.1, 0.2), 50);
}
function playHit() {
    playTone(800, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(1200, 'sine', 0.1, 0.1), 50);
}
function playError() {
    playTone(150, 'sawtooth', 0.4, 0.3);
}

// ─── THREE.JS SETUP ────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020617, 0.02);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 15);

const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// ─── GAME STATE ────────────────────────────────────────────────────
let targetNumber = 10;
let score = 0;
let lives = 3;
let playing = false;
let cans = [];
let spawnTimer = 0;
let spawnRate = 2.0;

const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

function generateTexture(number) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#cbd5e1'; // light gray metal
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ef4444'; // red stripe
    ctx.fillRect(0, 30, 128, 68);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 50px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number, 32, 64);
    ctx.fillText(number, 96, 64);
    
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}

let bottleGeometry = new THREE.CylinderGeometry(1, 1, 3, 16);
if (THREE.OBJLoader) {
    const loader = new THREE.OBJLoader();
    loader.load('assets/bottle.obj', (obj) => {
        obj.traverse((child) => {
            if (child.isMesh) {
                bottleGeometry = child.geometry;
                bottleGeometry.scale(2.5, 2.5, 2.5);
                bottleGeometry.translate(0, -3.75, 0); // Center the bottle a bit
            }
        });
    });
}


function spawnCan() {
    // Generate a random number. Some should be factors, some shouldn't.
    // Let's pick random from 1 to 20
    const num = Math.floor(Math.random() * 20) + 1;
    const isFactor = (targetNumber % num === 0);

    const mat = new THREE.MeshPhongMaterial({
        map: generateTexture(num),
        shininess: 80
    });
    
    const mesh = new THREE.Mesh(bottleGeometry, mat);
    
    // Spawn at bottom
    mesh.position.set((Math.random() - 0.5) * 16, -10, (Math.random() - 0.5) * 4);
    
    // Random rotation
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    
    scene.add(mesh);
    
    cans.push({
        mesh,
        num,
        isFactor,
        vx: (Math.random() - 0.5) * 4,
        vy: 15 + Math.random() * 5, // Lowered throw height
        vz: (Math.random() - 0.5) * 2,
        rx: Math.random() * 5 - 2.5,
        ry: Math.random() * 5 - 2.5,
        rz: Math.random() * 5 - 2.5
    });
}

// ─── GAME LOGIC ────────────────────────────────────────────────────

function updateLives() {
    dom.lives.textContent = '♥'.repeat(lives) + '♡'.repeat(3 - lives);
}

function flashRed() {
    dom.flash.classList.add('on');
    setTimeout(() => dom.flash.classList.remove('on'), 150);
}

function loseLife(reason) {
    lives--;
    updateLives();
    flashRed();
    playError();
    if (lives <= 0) {
        endGame(reason);
    }
}

function endGame(reason) {
    playing = false;
    dom.goDesc.innerHTML = `${reason}<br><br>Final Score: ${score}`;
    dom.gameOver.classList.add('show');
}

function startRound() {
    // Pick new target number < 20 (between 4 and 19)
    targetNumber = Math.floor(Math.random() * 16) + 4;
    dom.target.textContent = targetNumber;
}

dom.btnStart.addEventListener('click', () => {
    dom.startScreen.classList.remove('visible');
    score = 0;
    lives = 3;
    dom.score.textContent = score;
    updateLives();
    startRound();
    playing = true;
});

// Aiming
window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    dom.crosshair.style.left = e.clientX + 'px';
    dom.crosshair.style.top = e.clientY + 'px';
});

// Shooting
window.addEventListener('mousedown', (e) => {
    if (!playing) return;
    playShoot();
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cans.map(c => c.mesh));
    
    if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const index = cans.findIndex(c => c.mesh === hitMesh);
        if (index > -1) {
            const can = cans[index];
            scene.remove(can.mesh);
            cans.splice(index, 1);
            
            if (!can.isFactor) {
                // Correct! Shot a non-factor
                playHit();
                score++;
                dom.score.textContent = score;
                // Speed up slightly
                spawnRate = Math.max(0.6, spawnRate - 0.02);
                
                // Change target every 5 points
                if (score % 5 === 0) startRound();
            } else {
                // Wrong! Shot a factor
                loseLife(`You shot ${can.num}, which IS a factor of ${targetNumber}!`);
            }
        }
    }
});

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── LOOP ──────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    
    if (!playing) {
        renderer.render(scene, camera);
        return;
    }
    
    // Spawn
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnCan();
        spawnTimer = spawnRate + Math.random() * 0.5;
    }
    
    // Physics
    for (let i = cans.length - 1; i >= 0; i--) {
        const c = cans[i];
        
        c.mesh.position.x += c.vx * dt;
        c.mesh.position.y += c.vy * dt;
        c.mesh.position.z += c.vz * dt;
        
        c.mesh.rotation.x += c.rx * dt;
        c.mesh.rotation.y += c.ry * dt;
        c.mesh.rotation.z += c.rz * dt;
        
        c.vy -= 15 * dt; // Gravity
        
        // Check if fallen off
        if (c.mesh.position.y < -12 && c.vy < 0) {
            scene.remove(c.mesh);
            cans.splice(i, 1);
            
            // If it was a non-factor, the player missed it!
            if (!c.isFactor) {
                loseLife(`You let ${c.num} drop, but it wasn't a factor of ${targetNumber}!`);
            }
        }
    }
    
    renderer.render(scene, camera);
}

animate();
