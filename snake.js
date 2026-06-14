// =====================================================
// Math Snake 3D
// =====================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ─── Config ──────────────────────────────────────────
const GROUND_SIZE = 35;
const BALL_RADIUS = 0.6;
const FOOD_RADIUS = 1.5; // Food balls are big so numbers are easy to read
const SNAKE_SPEED = 12;
const ENEMY_SPEED = 10;
const SEGMENT_SPACING = 1.1; // Distance between snake segments
const GAME_TIME = 60;

// ─── DOM ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const canvas = $('c');
const dom = {
    sPlayer: $('s-player'),
    sTime: $('s-time'),
    sEnemy: $('s-enemy'),
    sTarget: $('s-target'),
    gameOver: $('game-over'),
    goTitle: $('go-title'),
    goDesc: $('go-desc')
};

// ─── Three.js ────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.FogExp2(0x1a1a2e, 0.004);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
// Completely static top-down camera: the whole field is always in view and
// never moves, so the snake visibly moves across a fixed arena.
camera.up.set(0, 0, -1); // Stable up vector for a straight-down view
camera.position.set(0, 95, 0);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.5, 0.85);
composer.addPass(bloom);

// ─── Lighting ────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x202040, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(10, 30, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 100;
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
scene.add(sun);

// ─── Ground ──────────────────────────────────────────
const geo = new THREE.CircleGeometry(GROUND_SIZE, 64);
const mat = new THREE.MeshStandardMaterial({ color: 0x2a2a4a, metalness: 0.1, roughness: 0.8 });
const ground = new THREE.Mesh(geo, mat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(GROUND_SIZE * 2, 20, 0x06b6d4, 0x06b6d4);
grid.position.y = 0.05;
grid.material.opacity = 0.15;
grid.material.transparent = true;
scene.add(grid);

const rim = new THREE.Mesh(
    new THREE.TorusGeometry(GROUND_SIZE, 0.2, 16, 100),
    new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.2 })
);
rim.rotation.x = Math.PI / 2;
rim.position.y = 0.1;
scene.add(rim);

// ─── Helpers ─────────────────────────────────────────
const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);

function createSegment(color) {
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.3, emissive: color, emissiveIntensity: 0.2 });
    const mesh = new THREE.Mesh(ballGeo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
}

// ─── Player Snake ────────────────────────────────────
let playerLength = 5;
const playerSegments = [];
const playerHistory = [];
const playerHead = createSegment(0x10b981); // Emerald
playerHead.position.set(0, BALL_RADIUS, 5);
playerSegments.push(playerHead);

// Mouse steering target
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const targetPos = new THREE.Vector3(0, BALL_RADIUS, 0);

window.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// ─── Enemy Snake ─────────────────────────────────────
let enemyLength = 5;
const enemySegments = [];
const enemyHistory = [];
const enemyHead = createSegment(0xf59e0b); // Amber
enemyHead.position.set(0, BALL_RADIUS, -15);
enemySegments.push(enemyHead);
const enemyTarget = new THREE.Vector3(0, BALL_RADIUS, 0);
let enemyWanderAngle = Math.random() * Math.PI * 2;

// ─── Mission: player chooses EVEN or ODD ─────────────
let TARGET_EVEN = true;
let gameStarted = false;

function startGame(even) {
    TARGET_EVEN = even;
    dom.sTarget.textContent = even ? 'EVEN' : 'ODD';
    $('choice-screen').classList.add('hidden');
    clock.getDelta(); // discard time spent on the choice screen
    gameStarted = true;
}
$('btn-even').addEventListener('click', () => startGame(true));
$('btn-odd').addEventListener('click', () => startGame(false));

// ─── Food (Numbers) ──────────────────────────────────
const foods = [];
const foodGeo = new THREE.SphereGeometry(FOOD_RADIUS, 32, 32);
const foodTextures = {};

function getNumberTexture(num, isEven) {
    const key = `${num}`;
    if (foodTextures[key]) return foodTextures[key];

    const size = 256;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');

    // Dark recessed circle for an "embedded/engraved" look
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 4, 0, Math.PI * 2);
    ctx.fill();

    // Subtle rim to sell the inset effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 8, 0, Math.PI * 2);
    ctx.stroke();

    // Huge white number filling the disc (smaller font for 2-digit numbers)
    ctx.font = `900 ${num < 10 ? 235 : 160}px "Outfit", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(num, size/2, size/2 + (num < 10 ? 12 : 8));

    const tex = new THREE.CanvasTexture(c);
    foodTextures[key] = tex;
    return tex;
}

function spawnFood() {
    if (foods.length >= 18) return;

    // Random number between 1 and 99
    const num = 1 + Math.floor(Math.random() * 99);
    const isEven = num % 2 === 0;

    const mat = new THREE.MeshStandardMaterial({ 
        color: 0x64748b, // Neutral for both, no odd/even hinting!
        metalness: 0.1, roughness: 0.8
    });
    
    const mesh = new THREE.Mesh(foodGeo, mat);

    // Flat number disc embedded in the top of the ball (faces the top-down camera)
    const disc = new THREE.Mesh(
        new THREE.CircleGeometry(FOOD_RADIUS * 0.95, 32),
        new THREE.MeshBasicMaterial({ map: getNumberTexture(num, isEven), transparent: true })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = FOOD_RADIUS + 0.02;
    mesh.add(disc);
    
    // Random position within circle
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * (GROUND_SIZE - 2);
    mesh.position.set(Math.cos(angle) * radius, FOOD_RADIUS, Math.sin(angle) * radius);
    
    // Spawn drop animation
    mesh.position.y += 10;
    mesh.castShadow = true;
    
    scene.add(mesh);
    foods.push({ mesh, num, isEven, vy: 0 });
}

// ─── Game Logic ──────────────────────────────────────
let timeLeft = GAME_TIME;
let fightMode = false;
let gameOver = false;

function growSnake(snakeSegments, color, amount) {
    for (let i = 0; i < amount; i++) {
        const seg = createSegment(color);
        // Start it hidden underneath the last segment
        const lastSeg = snakeSegments[snakeSegments.length - 1];
        seg.position.copy(lastSeg.position);
        snakeSegments.push(seg);
    }
}

function shrinkSnake(snakeSegments, amount, isPlayer) {
    const toRemove = Math.min(amount, snakeSegments.length - 1); // keep head
    for (let i = 0; i < toRemove; i++) {
        const seg = snakeSegments.pop();
        scene.remove(seg);
        seg.geometry.dispose();
        seg.material.dispose();
    }
    
    if (isPlayer) {
        playerLength -= toRemove;
        if (playerLength < 1) triggerGameOver(false, "You shrank to nothing!");
    } else {
        enemyLength -= toRemove;
    }
}

function triggerGameOver(win, reason) {
    if (gameOver) return;
    gameOver = true;
    dom.gameOver.classList.add('show');
    dom.goTitle.textContent = win ? "YOU WIN!" : "YOU LOSE!";
    dom.goTitle.className = "go-title " + (win ? "win" : "lose");
    dom.goDesc.textContent = reason;
}

// ─── Particles ───────────────────────────────────────
const particles = [];
function burstParticles(origin, color, count) {
    for (let i = 0; i < count; i++) {
        const geo = new THREE.SphereGeometry(0.15, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color });
        const p = new THREE.Mesh(geo, mat);
        p.position.copy(origin);
        const dir = new THREE.Vector3((Math.random()-0.5)*2, Math.random()*2, (Math.random()-0.5)*2).normalize();
        p.userData = { vel: dir.multiplyScalar(5 + Math.random()*5), life: 1.0 };
        scene.add(p);
        particles.push(p);
    }
}

// ─── Main Loop ───────────────────────────────────────
const clock = new THREE.Clock();

function updateSnake(dt, head, segments, history, target, speed, isPlayer) {
    // 1. Move Head towards target
    const dir = new THREE.Vector3().subVectors(target, head.position);
    dir.y = 0;
    if (dir.length() > 0.1) {
        dir.normalize();
        head.position.addScaledVector(dir, speed * dt);
        
        // Clamp to circle arena
        const dist = Math.sqrt(head.position.x**2 + head.position.z**2);
        if (dist > GROUND_SIZE - BALL_RADIUS) {
            head.position.x *= (GROUND_SIZE - BALL_RADIUS) / dist;
            head.position.z *= (GROUND_SIZE - BALL_RADIUS) / dist;
        }
    }

    // 2. Record history
    history.unshift(head.position.clone());
    // Only keep enough history to cover max possible length
    if (history.length > 500) history.pop();

    // 3. Move Segments along history
    let distAccum = 0;
    let histIdx = 0;
    for (let i = 1; i < segments.length; i++) {
        const seg = segments[i];
        
        // Find the history point that is SEGMENT_SPACING away
        let targetPoint = history[histIdx];
        while (histIdx < history.length - 1) {
            const prev = history[histIdx];
            const next = history[histIdx + 1];
            distAccum += prev.distanceTo(next);
            histIdx++;
            
            if (distAccum >= i * SEGMENT_SPACING) {
                targetPoint = next;
                break;
            }
        }
        
        if (targetPoint) {
            seg.position.lerp(targetPoint, 0.5);
        }
    }
}

function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (gameOver || !gameStarted) {
        composer.render();
        return;
    }

    // --- Time ---
    if (!fightMode) {
        timeLeft -= dt;
        if (timeLeft <= 0) {
            timeLeft = 0;
            fightMode = true;
            // Remove all food
            foods.forEach(f => { scene.remove(f.mesh); burstParticles(f.mesh.position, 0xffffff, 5); });
            foods.length = 0;
        }
        dom.sTime.textContent = Math.ceil(timeLeft);
    } else {
        dom.sTime.textContent = "FIGHT!";
    }

    // --- Player Input ---
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(groundPlane, targetPos);
    
    // In fight mode, both snakes charge straight at each other — biggest wins
    if (fightMode) {
        targetPos.copy(enemyHead.position);
    }

    updateSnake(dt, playerHead, playerSegments, playerHistory, targetPos, SNAKE_SPEED, true);

    // --- Enemy AI ---
    if (fightMode) {
        enemyTarget.copy(playerHead.position); // charge the player head-on
    } else {
        // Wander or seek food
        if (Math.random() < 0.02) enemyWanderAngle += (Math.random() - 0.5);
        let closestFood = null;
        let closestDist = Infinity;
        foods.forEach(f => {
            const d = enemyHead.position.distanceTo(f.mesh.position);
            // Enemy seeks the correct (target parity) numbers
            if (d < closestDist && f.isEven === TARGET_EVEN) {
                closestDist = d;
                closestFood = f;
            }
        });
        
        if (closestFood && closestDist < 15) {
            enemyTarget.copy(closestFood.mesh.position);
        } else {
            enemyTarget.x = enemyHead.position.x + Math.cos(enemyWanderAngle) * 5;
            enemyTarget.z = enemyHead.position.z + Math.sin(enemyWanderAngle) * 5;
            
            // Deflect off walls
            const d = Math.sqrt(enemyTarget.x**2 + enemyTarget.z**2);
            if (d > GROUND_SIZE - 5) {
                enemyWanderAngle += Math.PI; // turn around
            }
        }
    }

    updateSnake(dt, enemyHead, enemySegments, enemyHistory, enemyTarget, ENEMY_SPEED, false);

    // --- Food Logic ---
    if (!fightMode) {
        if (Math.random() < 0.08) spawnFood();

        for (let i = foods.length - 1; i >= 0; i--) {
            const f = foods[i];
            
            // Gravity drop
            if (f.mesh.position.y > FOOD_RADIUS) {
                f.vy -= 30 * dt;
                f.mesh.position.y += f.vy * dt;
                if (f.mesh.position.y < FOOD_RADIUS) {
                    f.mesh.position.y = FOOD_RADIUS;
                    f.vy = Math.abs(f.vy) * 0.4;
                }
            }

            // Check collision with player
            if (playerHead.position.distanceTo(f.mesh.position) < BALL_RADIUS + FOOD_RADIUS) {
                if (f.isEven === TARGET_EVEN) {
                    playerLength += 1;
                    growSnake(playerSegments, 0x10b981, 1);
                    burstParticles(f.mesh.position, 0x3b82f6, 10);
                } else {
                    shrinkSnake(playerSegments, 1, true);
                    burstParticles(f.mesh.position, 0xef4444, 10);
                }
                dom.sPlayer.textContent = playerLength;
                scene.remove(f.mesh);
                foods.splice(i, 1);
                continue;
            }

            // Check collision with enemy
            if (enemyHead.position.distanceTo(f.mesh.position) < BALL_RADIUS + FOOD_RADIUS) {
                if (f.isEven === TARGET_EVEN) {
                    enemyLength += 1;
                    growSnake(enemySegments, 0xf59e0b, 1);
                    burstParticles(f.mesh.position, 0x3b82f6, 5);
                } else {
                    shrinkSnake(enemySegments, 1, false);
                    burstParticles(f.mesh.position, 0xef4444, 5);
                }
                dom.sEnemy.textContent = enemyLength;
                scene.remove(f.mesh);
                foods.splice(i, 1);
            }
        }
        
        // Enemy slowly passively grows over time if player is slow
        if (Math.random() < 0.005) {
            enemyLength += 1;
            growSnake(enemySegments, 0xf59e0b, 1);
            dom.sEnemy.textContent = enemyLength;
        }
    }

    // --- Fight Collision ---
    if (fightMode) {
        if (playerHead.position.distanceTo(enemyHead.position) < BALL_RADIUS * 3) {
            if (playerLength >= enemyLength) {
                burstParticles(enemyHead.position, 0xf59e0b, 50);
                triggerGameOver(true, `You ate the boss! (${playerLength} vs ${enemyLength})`);
            } else {
                burstParticles(playerHead.position, 0x10b981, 50);
                triggerGameOver(false, `The boss was too big! (${enemyLength} vs ${playerLength})`);
            }
        }
    }

    // --- Update Particles ---
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.userData.life -= dt;
        if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); continue; }
        p.position.addScaledVector(p.userData.vel, dt);
        p.userData.vel.y -= 15 * dt;
        if (p.position.y < 0.1) { p.position.y = 0.1; p.userData.vel.y *= -0.3; }
        p.scale.setScalar(p.userData.life);
    }

    composer.render();
}

loop();
