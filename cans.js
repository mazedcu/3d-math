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
scene.background = new THREE.TextureLoader().load('assets/brick_wall.png');

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

// Add rusty bench
const benchTex = new THREE.TextureLoader().load('assets/rusty_metal.png');
benchTex.wrapS = THREE.RepeatWrapping;
benchTex.wrapT = THREE.RepeatWrapping;
benchTex.repeat.set(4, 1);
const benchGeo = new THREE.BoxGeometry(70, 2, 6);
const benchMat = new THREE.MeshPhongMaterial({ map: benchTex });
const benchMesh = new THREE.Mesh(benchGeo, benchMat);
benchMesh.position.set(0, -10, -40);
scene.add(benchMesh);

// ─── GAME STATE ────────────────────────────────────────────────────
let targetNumber = 10;
let score = 0;
let lives = 3;
let playing = false;
let cans = [];
let nonFactorsRemaining = 0;
let particles = [];

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


function spawnBottles() {
    // Clear existing
    cans.forEach(c => scene.remove(c.mesh));
    cans = [];
    nonFactorsRemaining = 0;

    const startX = -30;
    const spacing = 6.6;

    for (let i = 0; i < 10; i++) {
        const num = Math.floor(Math.random() * 20) + 1;
        const isFactor = (targetNumber % num === 0);
        if (!isFactor) nonFactorsRemaining++;

        const mat = new THREE.MeshPhongMaterial({
            map: generateTexture(num),
            shininess: 80
        });
        
        const mesh = new THREE.Mesh(bottleGeometry, mat);
        
        // Spawn in a line
        mesh.position.set(startX + i * spacing, -5.25, -40);
        
        // Slight random rotation for variety
        mesh.rotation.y = Math.random() * Math.PI * 2;
        
        scene.add(mesh);
        
        cans.push({
            mesh,
            num,
            isFactor
        });
    }
    
    // If by chance there are no non-factors, generate again
    if (nonFactorsRemaining === 0) {
        spawnBottles();
    }
}

function createBlast(position) {
    const geom = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const colors = [0xef4444, 0xf97316, 0xcbd5e1, 0x475569];
    
    for (let i = 0; i < 20; i++) {
        const mat = new THREE.MeshPhongMaterial({
            color: colors[Math.floor(Math.random() * colors.length)]
        });
        const p = new THREE.Mesh(geom, mat);
        p.position.copy(position);
        
        // Random velocity
        const vx = (Math.random() - 0.5) * 30;
        const vy = (Math.random() - 0.2) * 30;
        const vz = (Math.random() - 0.5) * 30;
        
        scene.add(p);
        particles.push({
            mesh: p,
            vx, vy, vz,
            life: 1.0
        });
    }
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

function isPrime(num) {
    for (let i = 2, s = Math.sqrt(num); i <= s; i++) {
        if (num % i === 0) return false;
    }
    return num > 1;
}

function startRound() {
    // Pick new target number < 20 (between 4 and 19), must NOT be prime
    do {
        targetNumber = Math.floor(Math.random() * 16) + 4;
    } while (isPrime(targetNumber));
    
    dom.target.textContent = targetNumber;
    spawnBottles();
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
                createBlast(can.mesh.position);
                playHit();
                score++;
                dom.score.textContent = score;
                nonFactorsRemaining--;
                
                // Clear round if all non-factors are gone
                if (nonFactorsRemaining <= 0) {
                    setTimeout(startRound, 500);
                }
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
    
    // Slowly rotate bottles
    for (let i = 0; i < cans.length; i++) {
        cans[i].mesh.rotation.y += 0.5 * dt;
    }
    
    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        
        p.vy -= 60 * dt; // gravity
        
        p.life -= dt * 1.5; // fade out speed
        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        } else {
            p.mesh.scale.setScalar(p.life);
        }
    }
    
    renderer.render(scene, camera);
}

animate();
