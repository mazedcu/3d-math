// =====================================================
// Math Alien 3D — solve math, upgrade your gun, defend!
// =====================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ─── Config ──────────────────────────────────────────
const FIELD_W = 26;        // playfield width (x)
const SPAWN_Z = -90;       // aliens spawn depth
const BASE_Z = 2;          // aliens reaching this hit your base
const GAME_TIME = 60;
const MAX_WEAPON = 5;

// Weapon levels: fire rate (s), bullets per shot, damage
const WEAPONS = [
    { rate: 0.55, shots: 1, dmg: 1, color: 0x9ca3af },
    { rate: 0.40, shots: 1, dmg: 1, color: 0x06b6d4 },
    { rate: 0.35, shots: 2, dmg: 1, color: 0x10b981 },
    { rate: 0.28, shots: 3, dmg: 1, color: 0xf59e0b },
    { rate: 0.22, shots: 3, dmg: 2, color: 0xf43f5e }
];

// ─── DOM ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const canvas = $('c');
const dom = {
    sScore: $('s-score'), sWeapon: $('s-weapon'), sLives: $('s-lives'), sTime: $('s-time'),
    mathPanel: $('math-panel'), mpProblem: $('mp-problem'), mpInput: $('mp-input'),
    mpBtn: $('mp-btn'), mpFeedback: $('mp-feedback'),
    startScreen: $('start-screen'), btnStart: $('btn-start'), flash: $('flash'),
    gameOver: $('game-over'), goTitle: $('go-title'), goDesc: $('go-desc')
};

// ─── Three.js ────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05030f);
scene.fog = new THREE.FogExp2(0x05030f, 0.008);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 14, 18);
camera.lookAt(0, 0, -25);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.5, 0.2));

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.AmbientLight(0x404060, 1.0));
const sun = new THREE.DirectionalLight(0xaaaaff, 1.0);
sun.position.set(5, 20, 10);
scene.add(sun);

// ─── Battlefield ─────────────────────────────────────
const grid = new THREE.GridHelper(200, 50, 0x7c3aed, 0x2a1a5e);
grid.position.y = -1;
scene.add(grid);

// Starfield
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(400 * 3);
for (let i = 0; i < 400; i++) {
    starPos[i*3] = (Math.random() - 0.5) * 200;
    starPos[i*3+1] = 5 + Math.random() * 60;
    starPos[i*3+2] = -Math.random() * 200;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.7 })));

// ─── Player ship ─────────────────────────────────────
const ship = new THREE.Group();
const shipMat = new THREE.MeshStandardMaterial({ color: 0xc4b5fd, emissive: 0x7c3aed, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3 });
const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 4), shipMat);
nose.rotation.x = -Math.PI / 2;
ship.add(nose);
const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.7), shipMat);
wing.position.z = 0.5;
ship.add(wing);
ship.position.set(0, 0, 0);
scene.add(ship);

// Mouse steering (x axis)
let mouseX = 0;
window.addEventListener('pointermove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
});

// ─── Aliens ──────────────────────────────────────────
const aliens = [];
const alienBodyGeo = new THREE.SphereGeometry(0.8, 16, 12);
const alienDomeGeo = new THREE.SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);

function spawnAlien(elapsed) {
    const hp = 1 + Math.floor(elapsed / 20); // tougher aliens over time
    const g = new THREE.Group();
    const body = new THREE.Mesh(alienBodyGeo, new THREE.MeshStandardMaterial({
        color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.3, metalness: 0.3, roughness: 0.4
    }));
    body.scale.set(1.4, 0.5, 1.4);
    g.add(body);
    const dome = new THREE.Mesh(alienDomeGeo, new THREE.MeshStandardMaterial({
        color: 0x67e8f9, transparent: true, opacity: 0.75, emissive: 0x06b6d4, emissiveIntensity: 0.4
    }));
    dome.position.y = 0.25;
    g.add(dome);
    g.position.set((Math.random() - 0.5) * FIELD_W, 0, SPAWN_Z + Math.random() * 10);
    scene.add(g);
    aliens.push({ mesh: g, hp, maxHp: hp, wobble: Math.random() * Math.PI * 2, baseX: g.position.x });
}

// ─── Bullets & particles ─────────────────────────────
const bullets = [];
const bulletGeo = new THREE.SphereGeometry(0.18, 8, 8);

function shoot() {
    const w = WEAPONS[weaponLvl - 1];
    const spread = w.shots > 1 ? 0.6 : 0;
    for (let s = 0; s < w.shots; s++) {
        const b = new THREE.Mesh(bulletGeo, new THREE.MeshBasicMaterial({ color: w.color }));
        const offset = (s - (w.shots - 1) / 2) * spread;
        b.position.copy(ship.position).add(new THREE.Vector3(offset, 0, -1));
        b.userData = { vx: offset * 6, dmg: w.dmg };
        scene.add(b);
        bullets.push(b);
    }
}

const particles = [];
function burst(origin, color, count) {
    for (let i = 0; i < count; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 4, 4), new THREE.MeshBasicMaterial({ color }));
        p.position.copy(origin);
        const dir = new THREE.Vector3((Math.random()-0.5)*2, Math.random()*1.5, (Math.random()-0.5)*2).normalize();
        p.userData = { vel: dir.multiplyScalar(6 + Math.random()*6), life: 0.8 };
        scene.add(p);
        particles.push(p);
    }
}

// ─── Math problems (fractions, percentages, ×) ───────
let answer = 0;

function newProblem() {
    const kind = Math.floor(Math.random() * 3);
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    let text = '';
    if (kind === 0) {
        // Multiplication
        const a = rnd(3, 12), b = rnd(3, 12);
        answer = a * b;
        text = `${a} × ${b} = ?`;
    } else if (kind === 1) {
        // Fraction of a number (integer answer)
        const d = [2, 3, 4, 5][Math.floor(Math.random() * 4)];
        const n = rnd(1, d - 1);
        const base = d * rnd(2, 10);
        answer = base * n / d;
        text = `${n}/${d} of ${base} = ?`;
    } else {
        // Percentage of a number (integer answer)
        const pick = [[10, 10], [20, 5], [25, 4], [50, 2], [75, 4]][Math.floor(Math.random() * 5)];
        const pct = pick[0];
        const base = pick[1] * rnd(2, 12);
        answer = base * pct / 100;
        text = `${pct}% of ${base} = ?`;
    }
    dom.mpProblem.textContent = text;
    dom.mpInput.value = '';
}

function checkAnswer() {
    const guess = parseFloat(dom.mpInput.value);
    if (isNaN(guess)) return;
    if (Math.abs(guess - answer) < 1e-6) {
        if (weaponLvl < MAX_WEAPON) weaponLvl++;
        dom.mpFeedback.textContent = weaponLvl === MAX_WEAPON ? '✅ Correct! MAX POWER!' : `✅ Correct! Weapon upgraded to Lv ${weaponLvl}!`;
        dom.mpFeedback.className = 'mp-feedback good';
    } else {
        if (weaponLvl > 1) weaponLvl--;
        dom.mpFeedback.textContent = `❌ Nope, it was ${answer}. Weapon down to Lv ${weaponLvl}.`;
        dom.mpFeedback.className = 'mp-feedback bad';
    }
    dom.sWeapon.textContent = `Lv ${weaponLvl}`;
    newProblem();
}

dom.mpBtn.addEventListener('click', checkAnswer);
dom.mpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkAnswer(); });

// ─── Game state ──────────────────────────────────────
let started = false, gameDone = false;
let timeLeft = GAME_TIME;
let score = 0, lives = 3, weaponLvl = 1;
let fireTimer = 0, spawnTimer = 0, elapsed = 0;

function updateLives() {
    dom.sLives.textContent = '♥'.repeat(lives) + '♡'.repeat(3 - lives);
}

function endGame(win, desc) {
    if (gameDone) return;
    gameDone = true;
    dom.goTitle.textContent = win ? 'VICTORY' : 'BASE DESTROYED';
    dom.goTitle.className = 'go-title ' + (win ? 'win' : 'lose');
    dom.goDesc.textContent = desc;
    dom.gameOver.classList.add('show');
    dom.mathPanel.classList.add('hidden');
}

let flashTimeout = null;
function flashRed() {
    dom.flash.classList.add('on');
    clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => dom.flash.classList.remove('on'), 120);
}

dom.btnStart.addEventListener('click', () => {
    dom.startScreen.classList.add('hidden');
    dom.mathPanel.classList.remove('hidden');
    newProblem();
    clock.getDelta();
    started = true;
    dom.mpInput.focus();
});

// ─── Main loop ───────────────────────────────────────
const clock = new THREE.Clock();

function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (!started || gameDone) {
        composer.render();
        return;
    }

    elapsed += dt;
    timeLeft -= dt;
    dom.sTime.textContent = Math.ceil(timeLeft);
    if (timeLeft <= 0) {
        endGame(true, `You held the line! ${score} aliens destroyed with a Lv ${weaponLvl} weapon.`);
        composer.render();
        return;
    }

    // Ship follows mouse on x
    const targetX = mouseX * FIELD_W * 0.55;
    ship.position.x += (targetX - ship.position.x) * Math.min(1, dt * 10);
    ship.rotation.z = (targetX - ship.position.x) * -0.1;

    // Auto-fire
    fireTimer -= dt;
    if (fireTimer <= 0) {
        shoot();
        fireTimer = WEAPONS[weaponLvl - 1].rate;
    }

    // Spawn aliens (faster over time)
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnAlien(elapsed);
        spawnTimer = Math.max(0.5, 1.6 - elapsed * 0.018);
    }

    // Move bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.position.z -= 55 * dt;
        b.position.x += b.userData.vx * dt;
        if (b.position.z < SPAWN_Z - 10) {
            scene.remove(b);
            bullets.splice(i, 1);
        }
    }

    // Move aliens + collisions
    const alienSpeed = 6 + elapsed * 0.08;
    for (let i = aliens.length - 1; i >= 0; i--) {
        const a = aliens[i];
        a.wobble += dt * 2;
        a.mesh.position.z += alienSpeed * dt;
        a.mesh.position.x = a.baseX + Math.sin(a.wobble) * 1.5;
        a.mesh.rotation.y += dt;

        // Reached the base?
        if (a.mesh.position.z > BASE_Z) {
            scene.remove(a.mesh);
            aliens.splice(i, 1);
            lives--;
            updateLives();
            flashRed();
            if (lives <= 0) endGame(false, `The aliens overran your base! Score: ${score}`);
            continue;
        }

        // Bullet hits
        for (let j = bullets.length - 1; j >= 0; j--) {
            const b = bullets[j];
            if (b.position.distanceTo(a.mesh.position) < 1.4) {
                a.hp -= b.userData.dmg;
                scene.remove(b);
                bullets.splice(j, 1);
                burst(b.position, 0xf59e0b, 4);
                if (a.hp <= 0) {
                    burst(a.mesh.position, 0x10b981, 14);
                    scene.remove(a.mesh);
                    aliens.splice(i, 1);
                    score++;
                    dom.sScore.textContent = score;
                }
                break;
            }
        }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.userData.life -= dt;
        if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); continue; }
        p.position.addScaledVector(p.userData.vel, dt);
        p.scale.setScalar(Math.max(0.01, p.userData.life));
    }

    composer.render();
}

updateLives();
loop();
