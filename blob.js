// =====================================================
// BlobMerge — 3D Ball Grouping · Make Groups of 10!
// =====================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

let BALL_COUNT = 53;
const GROUND_SIZE = 28;
const SNAP_GAP = 0.55;
const SPRING_K = 280;
const SPRING_DAMP = 18;
const GROUND_FRICTION = 0.92;
const VELOCITY_DAMP = 0.94;
const GRAVITY = -20;
const BOUNCE = 0.3;
const BALL_RADIUS = 0.5;
const BALL_COLOR = 0x6366f1;    // indigo — all balls same color
const GROUP_TARGET = 10;

// ─── Audio ───────────────────────────────────────────
const audio = {
    ctx: null,
    init() {
        if (this.ctx) return;
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    },
    play(type) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const d = this.ctx.destination;
        const mk = (freq, wave, start, dur, vol) => {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = wave; o.frequency.setValueAtTime(freq, t + start);
            g.gain.setValueAtTime(vol, t + start);
            g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
            o.connect(g).connect(d); o.start(t + start); o.stop(t + start + dur);
        };
        switch (type) {
            case 'snap':
                mk(880, 'sine', 0, 0.12, 0.08); mk(1320, 'sine', 0.04, 0.1, 0.06);
                break;
            case 'grab':
                mk(440, 'sine', 0, 0.07, 0.05);
                break;
            case 'drop':
                mk(330, 'sine', 0, 0.08, 0.04);
                break;
            case 'complete':
                mk(523, 'sine', 0, 0.3, 0.12);
                mk(659, 'sine', 0.08, 0.28, 0.1);
                mk(784, 'sine', 0.16, 0.26, 0.1);
                mk(1047, 'sine', 0.24, 0.4, 0.12);
                mk(523, 'triangle', 0.3, 0.3, 0.06);
                break;
            case 'scatter':
                mk(200, 'triangle', 0, 0.2, 0.06);
                mk(300, 'triangle', 0.05, 0.15, 0.05);
                break;
            case 'nearComplete':
                mk(660, 'sine', 0, 0.08, 0.04);
                mk(880, 'sine', 0.03, 0.06, 0.03);
                break;
        }
    }
};

// ─── DOM ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const canvas = $('c');
const dom = {
    sScore: $('s-score'),
    sBalls: $('s-balls'),
    sGroups: $('s-groups'),
    notify: $('notify'),
    notifyText: $('notify-text'),
    countModal: $('count-modal'),
    countInput: $('count-input'),
    countSubmit: $('count-submit'),
    countCancel: $('count-cancel'),
    countResult: $('count-result'),
    hurray: $('hurray'),
    btnGuess: $('btn-guess'),
};

// ─── Three.js ────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f5);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 42, 5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.5, 0.88);
composer.addPass(bloom);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 3.5;
controls.minPolarAngle = 0;
controls.minDistance = 25;
controls.maxDistance = 70;
controls.target.set(0, 0, 0);
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };

// ─── Lighting ────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xc0c0d0, 0.9));
scene.add(new THREE.HemisphereLight(0xddeeff, 0xa0a0b0, 0.5));

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(12, 25, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
sun.shadow.bias = -0.001;
scene.add(sun);

const fill = new THREE.DirectionalLight(0xd0d0ff, 0.4);
fill.position.set(-10, 10, -10);
scene.add(fill);

// ─── Ground ──────────────────────────────────────────
(function makeGround() {
    const geo = new THREE.CircleGeometry(GROUND_SIZE, 80);
    const mat = new THREE.MeshStandardMaterial({ color: 0xe8e8f0, metalness: 0.05, roughness: 0.85 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid
    const gMat = new THREE.LineBasicMaterial({ color: 0xd0d0e0, transparent: true, opacity: 0.4 });
    for (let i = -GROUND_SIZE; i <= GROUND_SIZE; i += 2) {
        const mk = (a, b) => { const g = new THREE.BufferGeometry().setFromPoints([a, b]); scene.add(new THREE.Line(g, gMat)); };
        mk(new THREE.Vector3(-GROUND_SIZE, 0.01, i), new THREE.Vector3(GROUND_SIZE, 0.01, i));
        mk(new THREE.Vector3(i, 0.01, -GROUND_SIZE), new THREE.Vector3(i, 0.01, GROUND_SIZE));
    }

    // Rim
    const rim = new THREE.Mesh(
        new THREE.TorusGeometry(GROUND_SIZE, 0.08, 8, 128),
        new THREE.MeshStandardMaterial({ color: 0xb0b0c8, metalness: 0.3, roughness: 0.4 })
    );
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.05;
    scene.add(rim);
})();

// ─── Label Textures (pre-cached per count) ───────────
const labelTextures = {};

function getLabelTexture(count, completed) {
    const key = completed ? `done_${count}` : `${count}`;
    if (labelTextures[key]) return labelTextures[key];

    const size = 128;
    const c = document.createElement('canvas');
    c.width = size; c.height = size / 2;
    const ctx = c.getContext('2d');

    ctx.clearRect(0, 0, size, size / 2);

    // Background pill
    const nearComplete = count >= GROUP_TARGET - 2;
    ctx.fillStyle = completed ? 'rgba(16,185,129,0.9)'
        : nearComplete ? 'rgba(245,158,11,0.8)'
        : 'rgba(30,30,60,0.7)';

    const r = 16, w = size - 8, h = size / 2 - 8;
    ctx.beginPath();
    ctx.moveTo(4 + r, 4); ctx.lineTo(4 + w - r, 4); ctx.quadraticCurveTo(4 + w, 4, 4 + w, 4 + r);
    ctx.lineTo(4 + w, 4 + h - r); ctx.quadraticCurveTo(4 + w, 4 + h, 4 + w - r, 4 + h);
    ctx.lineTo(4 + r, 4 + h); ctx.quadraticCurveTo(4, 4 + h, 4, 4 + h - r);
    ctx.lineTo(4, 4 + r); ctx.quadraticCurveTo(4, 4, 4 + r, 4);
    ctx.fill();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(completed ? `✓ ${count}` : `${count}/${GROUP_TARGET}`, size / 2, size / 4);

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    labelTextures[key] = tex;
    return tex;
}

// Pre-cache
for (let i = 2; i <= GROUP_TARGET + 5; i++) getLabelTexture(i);

// Label sprite pool
const MAX_LABELS = 30;
const labelSprites = [];

(function initLabelPool() {
    for (let i = 0; i < MAX_LABELS; i++) {
        const mat = new THREE.SpriteMaterial({ map: getLabelTexture(2), transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(1.6, 0.8, 1);
        sprite.visible = false;
        sprite.renderOrder = 999;
        scene.add(sprite);
        labelSprites.push(sprite);
    }
})();

// ─── Ball System ─────────────────────────────────────
let balls = [];
let score = 0;

function createBall(x, z, dropHeight) {
    const geo = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
        color: BALL_COLOR,
        metalness: 0.15,
        roughness: 0.25,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(x, BALL_RADIUS + (dropHeight || 3 + Math.random() * 5), z);
    scene.add(mesh);

    // Shadow ring on ground
    const outGeo = new THREE.RingGeometry(BALL_RADIUS - 0.05, BALL_RADIUS + 0.08, 32);
    const outMat = new THREE.MeshBasicMaterial({ color: BALL_COLOR, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const outline = new THREE.Mesh(outGeo, outMat);
    outline.rotation.x = -Math.PI / 2;
    outline.position.y = 0.05;
    scene.add(outline);

    const ball = {
        mesh, outline,
        vel: new THREE.Vector3(0, 0, 0),
        pos: mesh.position,
        hovered: false,
        dragging: false,
        pulseTime: 0,
        completed: false,
        targetPos: null,
    };
    balls.push(ball);
    return ball;
}

function removeBall(ball) {
    scene.remove(ball.mesh);
    scene.remove(ball.outline);
    ball.mesh.geometry.dispose();
    ball.mesh.material.dispose();
    ball.outline.geometry.dispose();
    ball.outline.material.dispose();
}

function generateBallCount() {
    let c = Math.floor(Math.random() * 69) + 31; // 31 to 99
    if (c % 10 === 0) c += Math.floor(Math.random() * 9) + 1; // force non-multiple of 10
    return c;
}

function spawnBalls() {
    BALL_COUNT = generateBallCount();
    
    // Clear everything
    balls.forEach(b => removeBall(b));
    balls = [];
    connections = [];
    connectionMeshes.forEach(m => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
    connectionMeshes = [];
    score = 0;
    updateStats();

    for (let i = 0; i < BALL_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 2 + Math.random() * (GROUND_SIZE - 4);
        createBall(Math.cos(angle) * dist, Math.sin(angle) * dist);
    }
}

function scatterBalls() {
    audio.play('scatter');

    // Only remove connections between non-completed balls
    for (let i = connections.length - 1; i >= 0; i--) {
        const ca = balls[connections[i].a], cb = balls[connections[i].b];
        if (ca.completed && cb.completed) continue; // keep completed group links
        scene.remove(connectionMeshes[i]);
        connectionMeshes[i].geometry.dispose();
        connectionMeshes[i].material.dispose();
        connections.splice(i, 1);
        connectionMeshes.splice(i, 1);
    }

    balls.forEach(b => {
        if (b.completed) return;
        const angle = Math.random() * Math.PI * 2;
        const power = 8 + Math.random() * 12;
        b.vel.set(Math.cos(angle) * power, 5 + Math.random() * 5, Math.sin(angle) * power);
    });
    updateStats();
}

// ─── Connections ─────────────────────────────────────
let connections = [];
let connectionMeshes = [];

function addConnection(idxA, idxB) {
    const exists = connections.some(c =>
        (c.a === idxA && c.b === idxB) || (c.a === idxB && c.b === idxA)
    );
    if (exists) return false;

    connections.push({ a: idxA, b: idxB });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.4 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    connectionMeshes.push(line);
    return true;
}

function removeConnectionsForBall(ballIdx) {
    for (let i = connections.length - 1; i >= 0; i--) {
        if (connections[i].a === ballIdx || connections[i].b === ballIdx) {
            scene.remove(connectionMeshes[i]);
            connectionMeshes[i].geometry.dispose();
            connectionMeshes[i].material.dispose();
            connections.splice(i, 1);
            connectionMeshes.splice(i, 1);
        }
    }
}

// Remap connection indices after removing balls
function remapConnections(removedIndices) {
    const sorted = [...removedIndices].sort((a, b) => b - a);

    // Remove connections that reference removed balls
    for (let i = connections.length - 1; i >= 0; i--) {
        if (sorted.includes(connections[i].a) || sorted.includes(connections[i].b)) {
            scene.remove(connectionMeshes[i]);
            connectionMeshes[i].geometry.dispose();
            connectionMeshes[i].material.dispose();
            connections.splice(i, 1);
            connectionMeshes.splice(i, 1);
        }
    }

    // Remap indices
    connections.forEach(c => {
        sorted.forEach(ri => {
            if (c.a > ri) c.a--;
            if (c.b > ri) c.b--;
        });
    });
}

// ─── Group Logic (Union-Find) ────────────────────────
function getGroups() {
    const parent = balls.map((_, i) => i);
    const rank = balls.map(() => 0);
    function find(x) { if (parent[x] !== x) parent[x] = find(parent[x]); return parent[x]; }
    function union(a, b) {
        const ra = find(a), rb = find(b);
        if (ra === rb) return;
        if (rank[ra] < rank[rb]) parent[ra] = rb;
        else if (rank[ra] > rank[rb]) parent[rb] = ra;
        else { parent[rb] = ra; rank[ra]++; }
    }
    connections.forEach(c => union(c.a, c.b));

    const groups = {};
    balls.forEach((_, i) => {
        const root = find(i);
        if (!groups[root]) groups[root] = [];
        groups[root].push(i);
    });
    return groups;
}

function areInSameGroup(a, b) {
    const groups = getGroups();
    for (const g of Object.values(groups)) {
        if (g.includes(a) && g.includes(b)) return true;
    }
    return false;
}

function getGroupOf(idx) {
    const groups = getGroups();
    for (const g of Object.values(groups)) {
        if (g.includes(idx)) return g;
    }
    return [idx];
}

// ─── Group Completion ────────────────────────────────
function checkGroupCompletion(triggerIdx) {
    const group = getGroupOf(triggerIdx);
    if (group.length >= GROUP_TARGET) {
        completeGroup(group);
        return true;
    }
    return false;
}

function completeGroup(groupIndices) {
    audio.play('complete');
    score++;

    // Release drag if needed
    if (dragBall && groupIndices.includes(balls.indexOf(dragBall))) {
        dragBall = null;
        controls.enabled = true;
        canvas.classList.remove('dragging');
    }

    // Mark balls as completed — they stay on field, locked & green
    groupIndices.forEach(idx => {
        const b = balls[idx];
        b.completed = true;
        b.dragging = false;
        b.pulseTime = 0.4;
        b.vel.set(0, 0, 0);
        // Change color to emerald
        b.mesh.material.color.set(0x10b981);
        b.mesh.material.emissive.set(0x10b981);
        b.mesh.material.emissiveIntensity = 0.25;
    });

    // Calculate center of mass
    const center = new THREE.Vector3();
    groupIndices.forEach(idx => center.add(balls[idx].pos));
    center.divideScalar(groupIndices.length);

    // Arrange into a neat circle around the center
    const count = groupIndices.length;
    const circleRadius = (count * (BALL_RADIUS * 2 + 0.1)) / (2 * Math.PI);
    groupIndices.forEach((idx, i) => {
        const angle = (Math.PI * 2 / count) * i;
        const tx = center.x + Math.cos(angle) * circleRadius;
        const tz = center.z + Math.sin(angle) * circleRadius;
        // Clamp target inside arena
        const d = Math.sqrt(tx * tx + tz * tz);
        const maxD = GROUND_SIZE - BALL_RADIUS - 0.5;
        if (d > maxD) {
            balls[idx].targetPos = new THREE.Vector3(tx * maxD / d, BALL_RADIUS, tz * maxD / d);
        } else {
            balls[idx].targetPos = new THREE.Vector3(tx, BALL_RADIUS, tz);
        }
    });
    burstParticles(center, 0x10b981, 40);
    burstParticles(center, 0xfbbf24, 25);
    spawnSnapRing(center, 0x10b981);
    spawnSnapRing(center, 0xfbbf24);

    // Particles from each ball
    groupIndices.forEach(idx => burstParticles(balls[idx].pos, 0x10b981, 5));

    score++;
    updateStats();
}

// ─── Particles & Effects ─────────────────────────────
const particles = [];

function burstParticles(origin, color, count = 20) {
    for (let i = 0; i < count; i++) {
        const size = 0.04 + Math.random() * 0.06;
        const geo = new THREE.SphereGeometry(size, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
        const p = new THREE.Mesh(geo, mat);
        p.position.copy(origin);
        const dir = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 2).normalize();
        p.userData = { vel: dir.multiplyScalar(3 + Math.random() * 6), life: 0.4 + Math.random() * 0.5 };
        p.userData.maxLife = p.userData.life;
        scene.add(p); particles.push(p);
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.userData.life -= dt;
        if (p.userData.life <= 0) { scene.remove(p); p.geometry.dispose(); p.material.dispose(); particles.splice(i, 1); continue; }
        const t = p.userData.life / p.userData.maxLife;
        p.material.opacity = t; p.scale.setScalar(t);
        p.position.addScaledVector(p.userData.vel, dt);
        p.userData.vel.y -= 12 * dt;
    }
}

const snapRings = [];
function spawnSnapRing(pos, color) {
    const geo = new THREE.RingGeometry(0.1, 0.2, 32);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const r = new THREE.Mesh(geo, mat);
    r.position.copy(pos); r.rotation.x = -Math.PI / 2;
    r.userData = { life: 0.5 };
    scene.add(r); snapRings.push(r);
}

function updateSnapRings(dt) {
    for (let i = snapRings.length - 1; i >= 0; i--) {
        const r = snapRings[i];
        r.userData.life -= dt;
        if (r.userData.life <= 0) { scene.remove(r); r.geometry.dispose(); r.material.dispose(); snapRings.splice(i, 1); continue; }
        const t = 1 - r.userData.life / 0.5;
        r.scale.setScalar(1 + t * 8); r.material.opacity = (1 - t) * 0.5;
    }
}

// ─── Drag System ─────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragOffset = new THREE.Vector3();
let dragBall = null;
let hoveredBall = null;

function getBallAt(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    let closest = null, closestDist = Infinity;
    for (const b of balls) {
        if (b.completed) continue;
        const hits = raycaster.intersectObject(b.mesh);
        if (hits.length > 0 && hits[0].distance < closestDist) {
            closestDist = hits[0].distance; closest = b;
        }
    }
    return closest;
}

function getDragPoint(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const t = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, t);
    return t;
}

canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    audio.init();
    const ball = getBallAt(e);
    if (!ball || ball.completed) return;
    e.preventDefault();
    controls.enabled = false;
    canvas.classList.add('dragging');
    dragBall = ball;
    dragBall.dragging = true;
    dragPlane.constant = -dragBall.pos.y;
    const pt = getDragPoint(e);
    if (pt) dragOffset.copy(dragBall.pos).sub(pt);
    audio.play('grab');

    const group = getGroupOf(balls.indexOf(dragBall));
    group.forEach(idx => { balls[idx].dragging = true; });
});

canvas.addEventListener('pointermove', (e) => {
    if (!dragBall) {
        const ball = getBallAt(e);
        if (ball !== hoveredBall) {
            if (hoveredBall) hoveredBall.hovered = false;
            hoveredBall = ball;
            if (hoveredBall) hoveredBall.hovered = true;
        }
        canvas.style.cursor = hoveredBall ? 'grab' : '';
        return;
    }

    const pt = getDragPoint(e);
    if (!pt) return;
    const target = pt.add(dragOffset);

    // Clamp to arena
    const dist = Math.sqrt(target.x * target.x + target.z * target.z);
    if (dist > GROUND_SIZE - 1) { target.x *= (GROUND_SIZE - 1) / dist; target.z *= (GROUND_SIZE - 1) / dist; }

    dragBall.pos.x = target.x;
    dragBall.pos.z = target.z;
    dragBall.pos.y = Math.max(BALL_RADIUS, dragBall.pos.y);
    dragBall.vel.set(0, 0, 0);

    // Check snap
    const dragIdx = balls.indexOf(dragBall);
    for (let i = 0; i < balls.length; i++) {
        if (i === dragIdx || balls[i].completed) continue;
        if (areInSameGroup(dragIdx, i)) continue;

        const d = dragBall.pos.distanceTo(balls[i].pos);
        if (d < BALL_RADIUS * 2 + SNAP_GAP) {
            const added = addConnection(dragIdx, i);
            if (added) {
                audio.play('snap');
                const mid = new THREE.Vector3().addVectors(dragBall.pos, balls[i].pos).multiplyScalar(0.5);
                burstParticles(mid, 0x6366f1, 10);
                spawnSnapRing(mid, 0x818cf8);
                dragBall.pulseTime = 0.25;
                balls[i].pulseTime = 0.25;

                const newGroup = getGroupOf(dragIdx);
                if (newGroup.length === GROUP_TARGET - 1) {
                    audio.play('nearComplete');
                }

                // Check completion
                if (newGroup.length >= GROUP_TARGET) {
                    checkGroupCompletion(dragIdx);
                    return;
                }
                updateStats();
            }
        }
    }
});

canvas.addEventListener('pointerup', () => {
    if (!dragBall) return;
    const group = getGroupOf(balls.indexOf(dragBall));
    group.forEach(idx => { balls[idx].dragging = false; });
    dragBall = null;
    controls.enabled = true;
    canvas.classList.remove('dragging');
    audio.play('drop');
});

// ─── Guess Total Modal ─────────────────────────

dom.btnGuess.addEventListener('click', () => {
    dom.countInput.value = '';
    dom.countResult.textContent = '';
    dom.countResult.className = 'count-result';
    dom.countModal.classList.add('visible');
    dom.countInput.focus();
    controls.enabled = false;
});

dom.countCancel.addEventListener('click', () => {
    dom.countModal.classList.remove('visible');
    controls.enabled = true;
});

dom.countSubmit.addEventListener('click', () => {
    const answer = parseInt(dom.countInput.value, 10);
    const actual = BALL_COUNT;
    
    if (answer === actual) {
        dom.countResult.textContent = 'Correct! 🎉';
        dom.countResult.className = 'count-result correct';
        
        // Hurray effect
        dom.hurray.classList.remove('show');
        void dom.hurray.offsetWidth; // trigger reflow
        dom.hurray.classList.add('show');
        audio.play('complete');
        
        setTimeout(() => {
            dom.countModal.classList.remove('visible');
            controls.enabled = true;
            showNotify(`🏆 You counted all ${BALL_COUNT} balls!`);
        }, 1500);
    } else {
        dom.countResult.textContent = `Oops, try again! ❌`;
        dom.countResult.className = 'count-result wrong';
        dom.countInput.focus();
    }
});

// Also handle Enter key
dom.countInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') dom.countSubmit.click();
    if (e.key === 'Escape') dom.countCancel.click();
});

$('btn-reset').addEventListener('click', () => { audio.init(); spawnBalls(); });
$('btn-scatter').addEventListener('click', () => { audio.init(); scatterBalls(); });

// ─── Physics ─────────────────────────────────────────
function physicsStep(dt) {
    // Springs
    connections.forEach(conn => {
        if (conn.a >= balls.length || conn.b >= balls.length) return;
        const a = balls[conn.a], b = balls[conn.b];
        if (a.completed || b.completed) return;

        const diff = new THREE.Vector3().subVectors(b.pos, a.pos);
        const dist = diff.length();
        if (dist < 0.001) return;

        const restLen = BALL_RADIUS * 2 + 0.12;
        const dir = diff.normalize();
        const force = SPRING_K * (dist - restLen);
        const relVel = new THREE.Vector3().subVectors(b.vel, a.vel);
        const dampForce = SPRING_DAMP * relVel.dot(dir);
        const total = (force + dampForce) * dt;
        const fv = dir.multiplyScalar(total);

        if (!a.dragging) a.vel.add(fv);
        if (!b.dragging) b.vel.sub(fv);
    });

    // Spatial grid for Ball-ball collision
    const CELL_SIZE = BALL_RADIUS * 2.5;
    const grid = new Map();

    const getCellKey = (pos) => {
        const cx = Math.floor(pos.x / CELL_SIZE);
        const cz = Math.floor(pos.z / CELL_SIZE);
        return `${cx},${cz}`;
    };

    // Populate grid
    for (let i = 0; i < balls.length; i++) {
        if (balls[i].completed) continue;
        const key = getCellKey(balls[i].pos);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i);
    }

    // Check collisions
    const checked = new Set();
    const offsets = [
        [0,0], [1,0], [1,1], [0,1], [-1,1], [-1,0], [-1,-1], [0,-1], [1,-1]
    ];

    for (const [key, cellBalls] of grid.entries()) {
        const [cx, cz] = key.split(',').map(Number);
        for (let i = 0; i < cellBalls.length; i++) {
            const bi = cellBalls[i];
            const a = balls[bi];
            
            for (const [dx, dz] of offsets) {
                const neighborKey = `${cx+dx},${cz+dz}`;
                if (!grid.has(neighborKey)) continue;
                const neighborBalls = grid.get(neighborKey);
                
                for (let j = 0; j < neighborBalls.length; j++) {
                    const bj = neighborBalls[j];
                    if (bi === bj) continue;
                    
                    // Prevent double checking
                    const pairKey = bi < bj ? `${bi}-${bj}` : `${bj}-${bi}`;
                    if (checked.has(pairKey)) continue;
                    checked.add(pairKey);
                    
                    const b = balls[bj];
                    const diff = new THREE.Vector3().subVectors(b.pos, a.pos);
                    const dist = diff.length();
                    const minD = BALL_RADIUS * 2;
                    if (dist < minD && dist > 0.001) {
                        const overlap = minD - dist;
                        const dir = diff.normalize();
                        if (!a.dragging && !b.dragging) {
                            a.pos.addScaledVector(dir, -overlap * 0.5);
                            b.pos.addScaledVector(dir, overlap * 0.5);
                        } else if (!a.dragging) a.pos.addScaledVector(dir, -overlap);
                        else if (!b.dragging) b.pos.addScaledVector(dir, overlap);

                        const rv = new THREE.Vector3().subVectors(a.vel, b.vel);
                        const van = rv.dot(dir);
                        if (van > 0) {
                            if (!a.dragging) a.vel.addScaledVector(dir, -van * 0.5);
                            if (!b.dragging) b.vel.addScaledVector(dir, van * 0.5);
                        }
                    }
                }
            }
        }
    }

    // Integrate
    balls.forEach(ball => {
        if (ball.dragging || ball.completed) return;
        ball.vel.y += GRAVITY * dt;
        ball.vel.multiplyScalar(VELOCITY_DAMP);
        ball.vel.x *= GROUND_FRICTION;
        ball.vel.z *= GROUND_FRICTION;
        ball.pos.addScaledVector(ball.vel, dt);

        if (ball.pos.y < BALL_RADIUS) {
            ball.pos.y = BALL_RADIUS;
            ball.vel.y = Math.abs(ball.vel.y) * BOUNCE;
            if (Math.abs(ball.vel.y) < 0.3) ball.vel.y = 0;
        }

        const d = Math.sqrt(ball.pos.x * ball.pos.x + ball.pos.z * ball.pos.z);
        const maxD = GROUND_SIZE - BALL_RADIUS;
        if (d > maxD) {
            ball.pos.x *= maxD / d; ball.pos.z *= maxD / d;
            const n = new THREE.Vector3(ball.pos.x, 0, ball.pos.z).normalize();
            const dot = ball.vel.dot(n);
            if (dot > 0) ball.vel.addScaledVector(n, -2 * dot * 0.5);
        }
    });
}

// ─── Visuals ─────────────────────────────────────────
function updateVisuals(dt, elapsed) {
    const groups = getGroups();

    // Build map: ballIdx -> groupSize
    const groupSizeMap = {};
    Object.values(groups).forEach(g => {
        g.forEach(idx => { groupSizeMap[idx] = g.length; });
    });

    balls.forEach((ball, idx) => {
        const groupSize = groupSizeMap[idx] || 1;

        // Completed state — lerp to formation + gentle glow
        if (ball.completed) {
            // Smoothly move to circle formation
            if (ball.targetPos) {
                ball.pos.lerp(ball.targetPos, Math.min(1, dt * 5));
            }
            ball.mesh.material.emissive.set(0x10b981);
            ball.mesh.material.emissiveIntensity = 0.15 + Math.sin(elapsed * 1.5) * 0.05;
            ball.outline.material.opacity = 0;
            // Still allow pulse animation to finish
            if (ball.pulseTime > 0) {
                ball.pulseTime -= dt;
                const t = ball.pulseTime / 0.4;
                ball.mesh.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.2);
                ball.mesh.material.emissiveIntensity = 0.3 + t * 0.4;
            } else {
                const s = ball.mesh.scale.x;
                ball.mesh.scale.setScalar(s + (1 - s) * Math.min(1, dt * 6));
            }
            return;
        }

        // Group glow: balls glow more as group approaches 10
        const progress = Math.min(groupSize / GROUP_TARGET, 1);
        const glowIntensity = progress * 0.3;
        if (!ball.dragging && ball.pulseTime <= 0) {
            ball.mesh.material.emissive.set(BALL_COLOR);
            ball.mesh.material.emissiveIntensity += (glowIntensity - ball.mesh.material.emissiveIntensity) * Math.min(1, dt * 5);
        }

        // Pulse on snap
        if (ball.pulseTime > 0) {
            ball.pulseTime -= dt;
            const t = ball.pulseTime / 0.25;
            ball.mesh.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.15);
            ball.mesh.material.emissive.set(0xffffff);
            ball.mesh.material.emissiveIntensity = t * 0.5;
        } else {
            const s = ball.mesh.scale.x;
            ball.mesh.scale.setScalar(s + (1 - s) * Math.min(1, dt * 8));
        }

        // Hover ring
        const hoverOpacity = ball.hovered && !dragBall ? 0.3 : 0;
        ball.outline.material.opacity += (hoverOpacity - ball.outline.material.opacity) * Math.min(1, dt * 12);
        ball.outline.position.set(ball.pos.x, 0.05, ball.pos.z);

        // Drag glow
        if (ball.dragging) {
            ball.mesh.material.emissive.set(0x818cf8);
            ball.mesh.material.emissiveIntensity = 0.2 + Math.sin(elapsed * 4) * 0.05;
        }
    });

    // Connection lines — color by group progress
    connections.forEach((conn, idx) => {
        if (idx >= connectionMeshes.length) return;
        if (conn.a >= balls.length || conn.b >= balls.length) return;
        const line = connectionMeshes[idx];
        const a = balls[conn.a], b = balls[conn.b];
        const arr = line.geometry.attributes.position.array;
        arr[0] = a.pos.x; arr[1] = a.pos.y; arr[2] = a.pos.z;
        arr[3] = b.pos.x; arr[4] = b.pos.y; arr[5] = b.pos.z;
        line.geometry.attributes.position.needsUpdate = true;

        const isCompleted = balls[conn.a].completed;
        const groupSize = groupSizeMap[conn.a] || 1;
        const progress = groupSize / GROUP_TARGET;
        if (isCompleted) {
            line.material.color.set(0x10b981);  // green — done
            line.material.opacity = 0.5;
        } else if (progress >= 0.9) {
            line.material.color.set(0xfbbf24);  // gold — almost done
            line.material.opacity = 0.7;
        } else if (progress >= 0.7) {
            line.material.color.set(0xf59e0b);  // amber
            line.material.opacity = 0.5;
        } else {
            line.material.color.set(0x818cf8);  // indigo
            line.material.opacity = 0.35 + progress * 0.2;
        }
    });

    // Floating labels above groups
    let labelIdx = 0;
    for (const members of Object.values(groups)) {
        if (members.length < 2 || labelIdx >= MAX_LABELS) continue;

        const isCompleted = balls[members[0]].completed;

        const center = new THREE.Vector3();
        members.forEach(i => center.add(balls[i].pos));
        center.divideScalar(members.length);

        const sprite = labelSprites[labelIdx];
        sprite.material.map = getLabelTexture(members.length, isCompleted);
        sprite.material.needsUpdate = true;
        sprite.position.copy(center);
        sprite.position.y += 1.6;
        sprite.visible = true;
        labelIdx++;
    }
    // Hide unused labels
    for (let i = labelIdx; i < MAX_LABELS; i++) {
        labelSprites[i].visible = false;
    }
}

// ─── Stats ───────────────────────────────────────────
function updateStats() {
    dom.sScore.textContent = score;
    dom.sGroups.textContent = score;
    const remaining = balls.filter(b => !b.completed).length;
    dom.sBalls.textContent = remaining;
}

function showNotify(text) {
    dom.notifyText.textContent = text;
    dom.notify.className = 'notify show';
    setTimeout(() => { dom.notify.className = 'notify'; }, 1000);
}

// ─── Resize ──────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Init ────────────────────────────────────────────
spawnBalls();

// ─── Main Loop ───────────────────────────────────────
const clock = new THREE.Clock();

function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();

    for (let s = 0; s < 3; s++) physicsStep(dt / 3);
    updateVisuals(dt, elapsed);
    updateParticles(dt);
    updateSnapRings(dt);
    controls.update();
    composer.render();
}

loop();
