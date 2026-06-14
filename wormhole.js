// =====================================================
// Wormhole 3D — fly the Matrix tunnel, dodge the primes
// =====================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ─── Config ──────────────────────────────────────────
const TUNNEL_RADIUS = 9;
const TUNNEL_LENGTH = 240;
const RING_SPACING = 8;
const PLAYER_Z = -7;
const GAME_TIME = 60;
const BASE_SPEED = 38;
const MAX_SPEED = 75;

// ─── DOM ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const canvas = $('c');
const dom = {
    sScore: $('s-score'),
    sLives: $('s-lives'),
    sTime: $('s-time'),
    startScreen: $('start-screen'),
    btnStart: $('btn-start'),
    flash: $('flash'),
    gameOver: $('game-over'),
    goTitle: $('go-title'),
    goDesc: $('go-desc')
};

// ─── Three.js ────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000300);
scene.fog = new THREE.FogExp2(0x001505, 0.0085);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 0, 0);
camera.lookAt(0, 0, -1);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.0, 0.6, 0.1));

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.AmbientLight(0x00ff66, 0.6));
const headlight = new THREE.PointLight(0x00ff88, 2, 60);
headlight.position.set(0, 0, -2);
scene.add(headlight);

// ─── Tunnel rings (Matrix green wireframe) ───────────
const rings = [];
const ringGeo = new THREE.TorusGeometry(TUNNEL_RADIUS, 0.08, 8, 48);
for (let i = 0; i < TUNNEL_LENGTH / RING_SPACING; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.35 });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.position.z = -i * RING_SPACING;
    scene.add(ring);
    rings.push(ring);
}

// ─── Tunnel curvature ────────────────────────────────
// The wormhole occasionally bends: far-away sections drift sideways and
// straighten out as they reach the player (so collisions stay fair at z≈PLAYER_Z).
function curveAmount(t) {
    // A gentle ever-present sway + strong bends that kick in every ~15s
    const bend = Math.max(0, Math.sin(t * 0.21));
    return {
        x: Math.sin(t * 0.5) * 6 + Math.sin(t * 0.33) * bend * 34,
        y: Math.sin(t * 0.41 + 2) * 3 + Math.sin(t * 0.26 + 1) * bend * 16
    };
}
function curveOffset(z, amt) {
    // Reaches full strength ~120 units in, so bends are visible well before the fog
    const f = Math.pow(Math.min(1, -Math.min(0, z) / 120), 1.7);
    return { x: amt.x * f, y: amt.y * f };
}

// ─── Digital rain particles ──────────────────────────
const RAIN_COUNT = 600;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_COUNT * 3);
const rainBase = new Float32Array(RAIN_COUNT * 2); // un-curved x/y per particle
for (let i = 0; i < RAIN_COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = TUNNEL_RADIUS * (0.55 + Math.random() * 0.42);
    rainBase[i*2] = Math.cos(a) * r;
    rainBase[i*2+1] = Math.sin(a) * r;
    rainPos[i*3] = rainBase[i*2];
    rainPos[i*3+1] = rainBase[i*2+1];
    rainPos[i*3+2] = -Math.random() * TUNNEL_LENGTH;
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x00ff66, size: 0.18, transparent: true, opacity: 0.8 }));
scene.add(rain);

// ─── Player ship ─────────────────────────────────────
const ship = new THREE.Group();
const shipBody = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 1.2, 16),
    new THREE.MeshStandardMaterial({ color: 0xb3ffd1, emissive: 0x00ff66, emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.3 })
);
shipBody.rotation.x = -Math.PI / 2;
ship.add(shipBody);
const shipGlow = new THREE.PointLight(0x00ff66, 1.5, 8);
ship.add(shipGlow);
ship.position.set(0, 0, PLAYER_Z);
scene.add(ship);

// Mouse steering
const mouse = new THREE.Vector2(0, 0);
window.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// ─── Numbers ─────────────────────────────────────────
function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
}

const numTextures = {};
function getNumberTexture(num) {
    if (numTextures[num]) return numTextures[num];
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    // Glowing green digit, Matrix style (same look for primes & non-primes!)
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 30;
    ctx.font = `900 ${num < 10 ? 200 : 140}px "JetBrains Mono", "Outfit", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#aaffcc';
    ctx.fillText(num, size/2, size/2 + 8);
    const tex = new THREE.CanvasTexture(c);
    numTextures[num] = tex;
    return tex;
}

const numbers = [];
function spawnNumber() {
    const num = 2 + Math.floor(Math.random() * 29); // 2..30
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getNumberTexture(num), transparent: true
    }));
    sprite.scale.set(3, 3, 1);
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * TUNNEL_RADIUS * 0.72;
    sprite.position.set(Math.cos(a) * r, Math.sin(a) * r, -TUNNEL_LENGTH + 20);
    scene.add(sprite);
    numbers.push({ sprite, num, baseX: Math.cos(a) * r, baseY: Math.sin(a) * r, prime: isPrime(num), hit: false });
}

// ─── Game state ──────────────────────────────────────
let started = false;
let gameDone = false;
let timeLeft = GAME_TIME;
let score = 0;
let lives = 3;
let speed = BASE_SPEED;
let spawnTimer = 0;

function updateLives() {
    dom.sLives.textContent = '♥'.repeat(lives) + '♡'.repeat(3 - lives);
}

function endGame(win, desc) {
    if (gameDone) return;
    gameDone = true;
    dom.goTitle.textContent = win ? 'YOU MADE IT' : 'WASTED BY A PRIME';
    dom.goTitle.className = 'go-title ' + (win ? 'win' : 'lose');
    dom.goDesc.textContent = desc;
    dom.gameOver.classList.add('show');
}

dom.btnStart.addEventListener('click', () => {
    dom.startScreen.classList.add('hidden');
    clock.getDelta();
    started = true;
});

let flashTimeout = null;
function flashRed() {
    dom.flash.classList.add('on');
    clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => dom.flash.classList.remove('on'), 120);
}

// ─── Main loop ───────────────────────────────────────
const clock = new THREE.Clock();

function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    const amt = curveAmount(t);

    // Tunnel always breathes, even on start screen
    rings.forEach((ring, i) => {
        ring.position.z += (started && !gameDone ? speed : 10) * dt;
        if (ring.position.z > 4) ring.position.z -= TUNNEL_LENGTH;
        const off = curveOffset(ring.position.z, amt);
        ring.position.x = off.x;
        ring.position.y = off.y;
        const wob = 1 + Math.sin(t * 2 + i * 0.4) * 0.03;
        ring.scale.set(wob, wob, 1);
    });

    // Rain
    const rp = rain.geometry.attributes.position.array;
    for (let i = 0; i < RAIN_COUNT; i++) {
        rp[i*3+2] += (started && !gameDone ? speed * 1.15 : 12) * dt;
        if (rp[i*3+2] > 2) rp[i*3+2] -= TUNNEL_LENGTH;
        const off = curveOffset(rp[i*3+2], amt);
        rp[i*3] = rainBase[i*2] + off.x;
        rp[i*3+1] = rainBase[i*2+1] + off.y;
    }
    rain.geometry.attributes.position.needsUpdate = true;

    if (!started || gameDone) {
        composer.render();
        return;
    }

    // Timer + speed ramp
    timeLeft -= dt;
    dom.sTime.textContent = Math.ceil(timeLeft);
    speed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * (1 - timeLeft / GAME_TIME);
    if (timeLeft <= 0) {
        endGame(true, `You surfed the wormhole and dodged every deadly prime. Score: ${score}`);
        composer.render();
        return;
    }

    // Steer ship (smooth)
    const tx = mouse.x * TUNNEL_RADIUS * 0.75;
    const ty = mouse.y * TUNNEL_RADIUS * 0.75;
    ship.position.x += (tx - ship.position.x) * Math.min(1, dt * 10);
    ship.position.y += (ty - ship.position.y) * Math.min(1, dt * 10);
    // Clamp inside tunnel
    const rr = Math.hypot(ship.position.x, ship.position.y);
    const maxR = TUNNEL_RADIUS * 0.8;
    if (rr > maxR) {
        ship.position.x *= maxR / rr;
        ship.position.y *= maxR / rr;
    }
    shipBody.rotation.z = (tx - ship.position.x) * -0.4; // bank into turns

    // Camera subtly follows the ship for a flying feel (no rotation)
    camera.position.x = ship.position.x * 0.25;
    camera.position.y = ship.position.y * 0.25;

    // Spawn numbers
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnNumber();
        spawnTimer = Math.max(0.25, 0.7 - (speed - BASE_SPEED) * 0.01);
    }

    // Move numbers & collide
    for (let i = numbers.length - 1; i >= 0; i--) {
        const n = numbers[i];
        n.sprite.position.z += speed * dt;
        const off = curveOffset(n.sprite.position.z, amt);
        n.sprite.position.x = n.baseX + off.x;
        n.sprite.position.y = n.baseY + off.y;

        // Collision window at the ship's depth
        if (!n.hit && n.sprite.position.z > PLAYER_Z - 1.2 && n.sprite.position.z < PLAYER_Z + 1.2) {
            const d = Math.hypot(n.sprite.position.x - ship.position.x, n.sprite.position.y - ship.position.y);
            if (d < 1.6) {
                n.hit = true;
                if (n.prime) {
                    lives--;
                    updateLives();
                    flashRed();
                    if (lives <= 0) {
                        endGame(false, `${n.num} is PRIME — it ripped your ship apart. Score: ${score}`);
                    }
                } else {
                    score++;
                    dom.sScore.textContent = score;
                }
                scene.remove(n.sprite);
                numbers.splice(i, 1);
                continue;
            }
        }

        // Passed behind the camera
        if (n.sprite.position.z > 2) {
            scene.remove(n.sprite);
            numbers.splice(i, 1);
        }
    }

    composer.render();
}

updateLives();
loop();
