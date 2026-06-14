import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ─── DOM Elements ──────────────────────────────────────
const $ = id => document.getElementById(id);
const dom = {
    level: $('s-level'), gap: $('s-gap'), len: $('s-len'),
    startScreen: $('start-screen'), btnStart: $('btn-start'),
    actionBar: $('action-bar'), btnTest: $('btn-test'), btnSaw: $('btn-saw'), btnReset: $('btn-reset'), sawHint: $('saw-hint'),
    resultScreen: $('result-screen'), resIcon: $('res-icon'), resTitle: $('res-title'), resDesc: $('res-desc'), btnNext: $('btn-next')
};

// ─── Game Config & State ───────────────────────────────
const WORLD_SCALE = 0.5; // 1 fraction unit = 0.5 3D units
const MAX_UNITS = 24;    // 24 units = 1 whole. Great for halving!

// Puzzles: units out of 24.
const LEVELS = [
    { target: 12, planks: [12] },                    // 1/2
    { target: 18, planks: [18] },                    // 3/4
    { target: 18, planks: [12, 6] },                 // 3/4 = 1/2 + 1/4
    { target: 15, planks: [12, 6] },                 // 5/8 (needs saw on 1/4 to get 1/8)
    { target: 21, planks: [12, 6, 6] },              // 7/8 (needs saw)
    { target: 24, planks: [12, 6, 6] },              // 1 
    { target: 8,  planks: [8] },                     // 1/3
    { target: 16, planks: [8, 8] },                  // 2/3
    { target: 20, planks: [12, 8] },                 // 5/6 = 1/2 + 1/3
    { target: 14, planks: [8, 6] },                  // 7/12 = 1/3 + 1/4
    { target: 27, planks: [24, 6] },                 // 1 1/8 = 1 + 1/4 (needs saw)
    { target: 22, planks: [12, 8, 4] }               // 11/12
];

const state = {
    level: 1,
    targetUnits: 12,
    started: false,
    testing: false,
    sawMode: false,
    dragPlank: null,
    dragOffset: new THREE.Vector3(),
    currentTraveler: null
};

const planks = []; // all plank objects { mesh, units, state: 'pile'|'bridge', tgtPos }
const bridgePlanks = []; // ordered array of planks in the bridge

// ─── Three.js Setup ────────────────────────────────────
const canvas = $('c');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);
scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.5, 0.6);
composer.addPass(bloom);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// Lighting
scene.add(new THREE.AmbientLight(0x334155, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(10, 20, 15);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -20; dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20; dirLight.shadow.camera.bottom = -20;
scene.add(dirLight);

const pointLight = new THREE.PointLight(0x10b981, 1, 20);
pointLight.position.set(0, -2, 0);
scene.add(pointLight);

// ─── Visual Assets ─────────────────────────────────────
const matCliff = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.1 });
const matPlank = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6, metalness: 0.05 });
const matTraveler = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.3, metalness: 0.8, emissive: 0x06b6d4, emissiveIntensity: 0.4 });

const worldGroup = new THREE.Group();
scene.add(worldGroup);

const particles = [];
function spawnParticles(pos, color, count) {
    for (let i = 0; i < count; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), new THREE.MeshBasicMaterial({ color }));
        p.position.copy(pos);
        const v = new THREE.Vector3((Math.random()-0.5)*2, Math.random()*2+1, (Math.random()-0.5)*2);
        particles.push({ mesh: p, vel: v, life: 1.0 });
        scene.add(p);
    }
}

function formatFraction(units) {
    if (units === 0) return '0';
    let num = units, den = MAX_UNITS;
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const d = gcd(num, den);
    num /= d; den /= d;
    if (den === 1) return `${num}`;
    if (num > den) {
        const whole = Math.floor(num / den);
        return `${whole} ${num % den}/${den}`;
    }
    return `${num}/${den}`;
}

function makeTextSprite(text, color = '#ffffff', sizeMult = 1) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = '800 64px "JetBrains Mono", monospace';
    
    const textWidth = ctx.measureText(text).width;
    const canvasWidth = Math.max(256, textWidth + 40);
    c.width = canvasWidth; c.height = 128;
    
    // Must re-apply context settings after resizing canvas
    ctx.font = '800 64px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8;
    ctx.fillText(text, canvasWidth / 2, 64);
    
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const s = new THREE.Sprite(mat);
    
    const worldWidth = (canvasWidth / 256) * 2.5 * sizeMult;
    s.scale.set(worldWidth, 1.25 * sizeMult, 1);
    s.renderOrder = 10;
    return s;
}

// ─── Level Building ────────────────────────────────────
let gapStart = 0, gapEnd = 0;

function clearLevel() {
    while (worldGroup.children.length) worldGroup.remove(worldGroup.children.pop());
    planks.forEach(p => scene.remove(p.mesh));
    planks.length = 0;
    bridgePlanks.length = 0;
    state.dragPlank = null;
    state.sawMode = false;
    dom.btnSaw.classList.remove('active');
    dom.sawHint.classList.remove('show');
    if (state.currentTraveler) {
        scene.remove(state.currentTraveler);
        state.currentTraveler = null;
    }
}

function buildLevel() {
    clearLevel();
    const cfg = LEVELS[Math.min(state.level - 1, LEVELS.length - 1)];
    state.targetUnits = cfg.target;
    
    gapStart = 0;
    gapEnd = state.targetUnits * WORLD_SCALE;

    // Camera
    camera.position.set(gapEnd / 2, 10, 14);
    camera.lookAt(gapEnd / 2, -1, 0);

    // Left Cliff
    const lCliff = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 10), matCliff);
    lCliff.position.set(-15, -5, 0);
    lCliff.receiveShadow = true;
    worldGroup.add(lCliff);

    // Right Cliff
    const rCliff = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 10), matCliff);
    rCliff.position.set(gapEnd + 15, -5, 0);
    rCliff.receiveShadow = true;
    worldGroup.add(rCliff);

    // Hazard Canyon Floor
    const canyon = new THREE.Mesh(new THREE.PlaneGeometry(gapEnd + 2, 12), new THREE.MeshStandardMaterial({ color: 0x050510, roughness: 1 }));
    canyon.rotation.x = -Math.PI/2; canyon.position.set(gapEnd/2, -9.5, 0);
    worldGroup.add(canyon);

    // Gap Label
    const gapLbl = makeTextSprite(`Gap: ${formatFraction(state.targetUnits)}`, '#f59e0b', 1.2);
    gapLbl.position.set(gapEnd / 2, 1.5, -3);
    worldGroup.add(gapLbl);

    // Ticks
    for (let i = 0; i <= state.targetUnits; i++) {
        if (i % 3 !== 0 && i !== state.targetUnits) continue; // Only show 1/8 ticks
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.5), new THREE.MeshBasicMaterial({ color: 0x334155 }));
        t.position.set(i * WORLD_SCALE, 0.05, 3.5);
        worldGroup.add(t);
    }

    // Spawn Planks
    cfg.planks.forEach((units, idx) => spawnPlank(units, idx));

    updateHUD();
}

function spawnPlank(units, pileIndex) {
    const w = units * WORLD_SCALE - 0.08;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 2), matPlank);
    mesh.castShadow = true; mesh.receiveShadow = true;
    
    const lbl = makeTextSprite(formatFraction(units), '#ffffff');
    lbl.position.y = 0.5; mesh.add(lbl);
    
    scene.add(mesh);
    
    const plank = {
        mesh, units, state: 'pile',
        tgtPos: new THREE.Vector3(-6 + (pileIndex % 3) * 2, 0.15 + Math.floor(pileIndex / 3) * 0.4, -2.5)
    };
    mesh.position.copy(plank.tgtPos);
    planks.push(plank);
    return plank;
}

// ─── Interaction ───────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5);

function getPlankFromHit(obj) {
    while (obj && obj !== scene) {
        const p = planks.find(p => p.mesh === obj);
        if (p) return p;
        obj = obj.parent;
    }
    return null;
}

window.addEventListener('pointerdown', e => {
    if (!state.started || state.testing) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    const hits = raycaster.intersectObjects(planks.map(p => p.mesh), true);
    if (!hits.length) return;
    
    const plank = getPlankFromHit(hits[0].object);
    if (!plank) return;

    if (state.sawMode) {
        // Saw it!
        if (plank.units % 2 !== 0 || plank.units <= 1) {
            showFloatText("Can't cut!", e.clientX, e.clientY, '#f43f5e');
            return;
        }
        spawnParticles(plank.mesh.position, 0xfcd34d, 15);
        
        // Remove old
        scene.remove(plank.mesh);
        planks.splice(planks.indexOf(plank), 1);
        if (plank.state === 'bridge') bridgePlanks.splice(bridgePlanks.indexOf(plank), 1);
        
        // Create 2 new
        const half = plank.units / 2;
        const p1 = spawnPlank(half, planks.length);
        const p2 = spawnPlank(half, planks.length + 1);
        p1.mesh.position.copy(plank.mesh.position).add(new THREE.Vector3(-0.5, 0, 0));
        p2.mesh.position.copy(plank.mesh.position).add(new THREE.Vector3(0.5, 0, 0));
        
        recalcBridge();
        state.sawMode = false;
        dom.btnSaw.classList.remove('active');
        dom.sawHint.classList.remove('show');
        return;
    }

    state.dragPlank = plank;
    raycaster.ray.intersectPlane(dragPlane, state.dragOffset);
    state.dragOffset.sub(plank.mesh.position);
    
    if (plank.state === 'bridge') {
        bridgePlanks.splice(bridgePlanks.indexOf(plank), 1);
        recalcBridge();
    }
    plank.state = 'drag';
});

window.addEventListener('pointermove', e => {
    if (!state.dragPlank || state.testing) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    const pt = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragPlane, pt)) {
        state.dragPlank.tgtPos.copy(pt.sub(state.dragOffset));
        state.dragPlank.tgtPos.y = 1.5; // lift up
    }
});

window.addEventListener('pointerup', () => {
    if (!state.dragPlank || state.testing) return;
    const p = state.dragPlank;
    state.dragPlank = null;
    
    // Check if dropped in gap area
    if (p.tgtPos.x > -2 && p.tgtPos.x < gapEnd + 2 && Math.abs(p.tgtPos.z) < 3) {
        p.state = 'bridge';
        bridgePlanks.push(p);
        spawnParticles(p.mesh.position, 0x10b981, 8);
    } else {
        p.state = 'pile';
        // Send back to pile (just append to end positions)
        p.tgtPos.set(-6 + (planks.indexOf(p) % 3) * 2, 0.15 + Math.floor(planks.indexOf(p) / 3) * 0.4, -2.5);
    }
    recalcBridge();
});

function recalcBridge() {
    let curUnits = 0;
    for (const p of bridgePlanks) {
        const w = p.units * WORLD_SCALE;
        p.tgtPos.set(curUnits * WORLD_SCALE + w / 2, 0.15, 0);
        curUnits += p.units;
    }
    updateHUD();
}

function updateHUD() {
    dom.level.textContent = state.level;
    dom.gap.textContent = formatFraction(state.targetUnits);
    const sum = bridgePlanks.reduce((acc, p) => acc + p.units, 0);
    dom.len.textContent = formatFraction(sum);
    if (sum === state.targetUnits) dom.len.style.color = 'var(--emerald)';
    else if (sum > state.targetUnits) dom.len.style.color = 'var(--rose)';
    else dom.len.style.color = 'var(--cyan)';
}

function showFloatText(text, x, y, color) {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.color = color; el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

// ─── UI Actions ────────────────────────────────────────
dom.btnStart.addEventListener('click', () => {
    dom.startScreen.classList.remove('show');
    dom.actionBar.classList.remove('hidden');
    state.started = true;
    buildLevel();
});

dom.btnSaw.addEventListener('click', () => {
    if (state.testing) return;
    state.sawMode = !state.sawMode;
    dom.btnSaw.classList.toggle('active', state.sawMode);
    dom.sawHint.classList.toggle('show', state.sawMode);
});

dom.btnReset.addEventListener('click', () => {
    if (state.testing) return;
    while(bridgePlanks.length) {
        const p = bridgePlanks.pop();
        p.state = 'pile';
        p.tgtPos.set(-6 + (planks.indexOf(p) % 3) * 2, 0.15 + Math.floor(planks.indexOf(p) / 3) * 0.4, -2.5);
    }
    recalcBridge();
});

dom.btnTest.addEventListener('click', () => {
    if (!state.started || state.testing) return;
    state.testing = true;
    
    if (state.currentTraveler) {
        scene.remove(state.currentTraveler);
        state.currentTraveler = null;
    }
    
    const sumUnits = bridgePlanks.reduce((acc, p) => acc + p.units, 0);
    const bridgeLenWorld = sumUnits * WORLD_SCALE;
    
    // Spawn Traveler
    const traveler = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), matTraveler);
    traveler.add(body);
    traveler.position.set(-2, 0.5, 0);
    scene.add(traveler);
    state.currentTraveler = traveler;
    
    let t = 0;
    const isPerfect = sumUnits === state.targetUnits;
    const isShort = sumUnits < state.targetUnits;
    const isLong = sumUnits > state.targetUnits;
    
    const targetX = isPerfect ? gapEnd + 2 : (isShort ? bridgeLenWorld : bridgeLenWorld - 0.5);
    const duration = isPerfect ? 2.5 : 2.0;
    
    function animStep(dt) {
        t += dt;
        const progress = Math.min(t / duration, 1);
        // ease in out
        const e = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        
        traveler.position.x = -2 + (targetX - -2) * e;
        
        // Spin
        body.rotation.z = -traveler.position.x * 2;
        
        if (progress < 1) {
            requestAnimationFrame(() => animStep(0.016));
        } else {
            if (isPerfect) {
                spawnParticles(traveler.position, 0x06b6d4, 30);
                setTimeout(() => showResult(true), 500);
            } else if (isShort) {
                // Fall!
                let fallT = 0;
                function fallStep() {
                    fallT += 0.016;
                    traveler.position.y -= fallT * 15 * 0.016;
                    if (traveler.position.y > -10) requestAnimationFrame(fallStep);
                    else setTimeout(() => showResult(false, 'Too Short!'), 200);
                }
                fallStep();
            } else if (isLong) {
                // Drive back!
                let backT = 0;
                function backStep() {
                    backT += 0.016;
                    const backProgress = Math.min(backT / duration, 1);
                    const be = backProgress < 0.5 ? 2 * backProgress * backProgress : -1 + (4 - 2 * backProgress) * backProgress;
                    traveler.position.x = targetX - (targetX - -2) * be;
                    body.rotation.z = traveler.position.x * 2; // reverse spin
                    if (backProgress < 1) requestAnimationFrame(backStep);
                    else setTimeout(() => showResult(false, 'Too Long!'), 200);
                }
                setTimeout(backStep, 400); // pause before returning
            }
        }
    }
    animStep(0);
});

function showResult(win, msg = '') {
    dom.resultScreen.classList.add('show');
    if (win) {
        dom.resIcon.textContent = '🎉';
        dom.resTitle.textContent = 'PERFECT!';
        dom.resTitle.className = 'm-title emerald';
        dom.resDesc.textContent = 'Your bridge matched the gap exactly! The traveler crossed safely.';
        dom.btnNext.textContent = 'Next Level';
        dom.btnNext.className = 'm-btn';
    } else {
        dom.resIcon.textContent = '💥';
        dom.resTitle.textContent = 'OH NO!';
        dom.resTitle.className = 'm-title rose';
        dom.resDesc.textContent = `${msg} The traveler didn't make it. Try sawing or combining different planks!`;
        dom.btnNext.textContent = 'Try Again';
        dom.btnNext.className = 'm-btn rose-btn';
    }
}

dom.btnNext.addEventListener('click', () => {
    dom.resultScreen.classList.remove('show');
    state.testing = false;
    
    // Check if won
    if (dom.resTitle.textContent === 'PERFECT!') {
        state.level++;
        buildLevel();
    }
});

// ─── Render Loop ───────────────────────────────────────
const clock = new THREE.Clock();

function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);

    // Lerp planks to tgtPos
    for (const p of planks) {
        if (p.state === 'drag') {
            p.mesh.position.lerp(p.tgtPos, dt * 20);
        } else {
            p.mesh.position.lerp(p.tgtPos, dt * 10);
        }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
            continue;
        }
        p.vel.y -= 9.8 * dt; // gravity
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.scale.setScalar(p.life);
    }

    composer.render();
}

loop();
