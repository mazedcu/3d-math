// =====================================================
// Cosmic Jumper 3D — how many jumps to reach the target tile?
// A boy hops along a zigzag path of tiles floating in space.
// Each jump advances a fixed number of tiles. Guess the number
// of jumps that lands him EXACTLY on the target tile — a wrong
// answer sends him tumbling into the abyss.
// =====================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ─── DOM ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const canvas = $('c');
const dom = {
    sJump: $('s-jump'),
    sTarget: $('s-target'),
    startScreen: $('start-screen'),
    btnStart: $('btn-start'),
    answerPanel: $('answer-panel'),
    apQuestion: $('ap-question'),
    answerInput: $('answer-input'),
    btnCheck: $('btn-check'),
    result: $('result'),
    resTitle: $('res-title'),
    resDesc: $('res-desc'),
    btnNext: $('btn-next')
};

// ─── Three.js ────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060f);
scene.fog = new THREE.FogExp2(0x05060f, 0.012);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 800);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.6, 0.82));

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Lighting ────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x5566aa, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(6, 24, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
scene.add(sun);
const rim = new THREE.PointLight(0x38bdf8, 1.2, 80);
rim.position.set(-10, 8, 6);
scene.add(rim);

// ─── Starfield ───────────────────────────────────────
(function makeStars() {
    const N = 1400;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
        const r = 80 + Math.random() * 320;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
        pos[i*3+1] = (Math.random() * 2 - 0.6) * 120;
        pos[i*3+2] = r * Math.sin(ph) * Math.sin(th) - 60;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xffffff, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.9 });
    scene.add(new THREE.Points(g, m));
})();

// ─── Text sprite helper (tile numbers) ───────────────
function makeTextSprite(text, color = '#ffffff', bold = true) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.font = `${bold ? 900 : 600} 150px "Outfit", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 18;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, 128, 138);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 138);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c), transparent: true, depthTest: false
    }));
    sprite.renderOrder = 5;
    return sprite;
}

// ─── Game constants ──────────────────────────────────
const COLS = 9;             // tiles per zigzag row
const SP = 2.6;             // tile spacing
const ROW_GAP = 1.45;       // depth multiplier between rows
const RISE = 0.55;          // how much each row rises into space
// Boy's feet rest exactly on the top face of a tile.
// Tile box is 0.4 tall (top = centre + 0.2); the boy's feet sit ~0.03 below his origin.
const FEET_OFFSET = 0.23;
// A round is built so an exact answer always exists: target = 1 + jumpSize * jumps.
const JUMP_CHOICES = [2, 3, 4, 5, 6, 7, 8];
const JUMPS_MIN = 4, JUMPS_MAX = 11;

// Tile index (1-based) → world position of its centre
function tilePos(i) {
    const idx = i - 1;
    const row = Math.floor(idx / COLS);
    let col = idx % COLS;
    if (row % 2 === 1) col = COLS - 1 - col;   // zigzag (boustrophedon)
    const x = (col - (COLS - 1) / 2) * SP;
    const z = -row * SP * ROW_GAP;
    const y = row * RISE;
    return new THREE.Vector3(x, y, z);
}

// ─── State ───────────────────────────────────────────
const pathGroup = new THREE.Group();
scene.add(pathGroup);
const tileMeshes = [];

let jumpSize = 8;
let correctJumps = 10;
let targetTile = 81;        // randomized each round
let busy = false;           // animating
let started = false;

// The boy launches from a START pad sitting one step BEFORE tile 1, so his
// jumps (multiples of the jump number) land him exactly on N, 2N, 3N, …
function startPadPos() {
    return tilePos(1).clone().multiplyScalar(2).sub(tilePos(2));
}
// Centre position for a path index (0 = the START pad, otherwise tile i).
function posForIndex(i) {
    return i === 0 ? startPadPos() : tilePos(i);
}
// Boy position helper: feet resting on top of the START pad / a tile.
function standPos(i) {
    return posForIndex(i).clone().add(new THREE.Vector3(0, FEET_OFFSET, 0));
}

// ─── Build the boy ───────────────────────────────────
const boy = new THREE.Group();
(function buildBoy() {
    const skin = new THREE.MeshStandardMaterial({ color: 0xf2c9a0, roughness: 0.6 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.5, emissive: 0x0a3a55, emissiveIntensity: 0.4 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.8 });

    // legs
    const legGeo = new THREE.CapsuleGeometry(0.13, 0.4, 4, 8);
    const lL = new THREE.Mesh(legGeo, pants); lL.position.set(-0.15, 0.3, 0);
    const lR = new THREE.Mesh(legGeo, pants); lR.position.set(0.15, 0.3, 0);
    // body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.45, 4, 10), shirt);
    body.position.y = 0.85;
    // arms
    const armGeo = new THREE.CapsuleGeometry(0.1, 0.42, 4, 8);
    const aL = new THREE.Mesh(armGeo, shirt); aL.position.set(-0.36, 0.92, 0); aL.rotation.z = 0.35;
    const aR = new THREE.Mesh(armGeo, shirt); aR.position.set(0.36, 0.92, 0); aR.rotation.z = -0.35;
    // head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 20), skin);
    head.position.y = 1.42;
    const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
    hairMesh.position.y = 1.46;

    boy.add(lL, lR, body, aL, aR, head, hairMesh);
    boy.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.base = o.position.clone(); } });
    boy.userData = { lL, lR, aL, aR, body };
    boy.scale.setScalar(1.0);
})();
scene.add(boy);

// ─── Build the zigzag path of tiles ──────────────────
function buildPath() {
    while (pathGroup.children.length) pathGroup.remove(pathGroup.children.pop());
    tileMeshes.length = 0;

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x6d4ed6, roughness: 0.45, metalness: 0.2, emissive: 0x2a1c5c, emissiveIntensity: 0.5 });
    const startMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4, metalness: 0.2, emissive: 0x065f46, emissiveIntensity: 0.6 });
    const targetMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.3, emissive: 0x7c4a02, emissiveIntensity: 0.7 });
    const tileGeo = new THREE.BoxGeometry(2.0, 0.4, 2.0);

    // START launch pad (index 0), one step before tile 1
    const pad = new THREE.Mesh(tileGeo, startMat);
    pad.position.copy(startPadPos());
    pad.castShadow = true;
    pad.receiveShadow = true;
    pathGroup.add(pad);
    const padLbl = makeTextSprite('START', '#a7f3d0');
    padLbl.scale.set(2.0, 0.7, 1);
    padLbl.position.copy(startPadPos()).add(new THREE.Vector3(0, 0.95, 0));
    pathGroup.add(padLbl);

    for (let i = 1; i <= targetTile; i++) {
        const mat = (i === targetTile) ? targetMat : baseMat;
        const t = new THREE.Mesh(tileGeo, mat.clone());
        t.position.copy(tilePos(i));
        t.castShadow = true;
        t.receiveShadow = true;
        t.userData = { idx: i, baseY: t.position.y, fallen: false, t0: i * 0.21 };
        pathGroup.add(t);
        tileMeshes.push(t);

        // number label floating above each tile
        const col = (i === targetTile) ? '#fde68a' : '#e2e8f0';
        const lbl = makeTextSprite(`${i}`, col);
        lbl.scale.set(1.1, 1.1, 1);
        lbl.position.copy(tilePos(i)).add(new THREE.Vector3(0, 0.95, 0));
        lbl.userData = { tile: t };
        pathGroup.add(lbl);
        t.userData.label = lbl;
    }
}

// ─── Round setup ─────────────────────────────────────
function newRound() {
    // The boy jumps in multiples of `jumpSize`, so the target is always a
    // multiple of it: target = jumpSize × jumps.
    jumpSize = JUMP_CHOICES[Math.floor(Math.random() * JUMP_CHOICES.length)];
    correctJumps = JUMPS_MIN + Math.floor(Math.random() * (JUMPS_MAX - JUMPS_MIN + 1));
    targetTile = jumpSize * correctJumps;
    buildPath();

    boy.visible = true;
    boy.rotation.set(0, 0, 0);
    boy.position.copy(standPos(0));   // on the START pad
    boy.lookAt(tilePos(jumpSize).x, boy.position.y, tilePos(jumpSize).z);

    dom.sJump.textContent = jumpSize;
    dom.sTarget.textContent = targetTile;
    dom.apQuestion.innerHTML =
        `The boy jumps in multiples of <b>${jumpSize}</b> — landing on ${jumpSize}, ${jumpSize * 2}, ${jumpSize * 3}… ` +
        `How many jumps land him exactly on tile&nbsp;<span>${targetTile}</span>?`;
    dom.answerInput.value = '';

    camFollow.copy(boy.position);
    snapCamera();
}

// ─── Camera follow ───────────────────────────────────
const camFollow = new THREE.Vector3();
const camOffset = new THREE.Vector3(0, 6.5, 11);
function desiredCamPos() {
    return camFollow.clone().add(camOffset);
}
function snapCamera() {
    camera.position.copy(desiredCamPos());
    camera.lookAt(camFollow.x, camFollow.y + 0.6, camFollow.z);
}

// ─── Animation action queue ──────────────────────────
let action = null;
const queue = [];
const enqueue = a => queue.push(a);

// hop arc from current boy pos to a target stand pos
function hopAction(toPos, height, dur) {
    let from = null;
    return {
        dur,
        init() {
            // Capture the start position when the hop BEGINS (not when it is queued),
            // so each jump starts from the tile the boy is actually standing on.
            from = boy.position.clone();
            // face travel direction
            const dir = new THREE.Vector3(toPos.x - from.x, 0, toPos.z - from.z);
            if (dir.lengthSq() > 1e-4) boy.lookAt(boy.position.x + dir.x, boy.position.y, boy.position.z + dir.z);
        },
        update(p) {
            const flat = from.clone().lerp(toPos, p);
            flat.y += Math.sin(Math.PI * p) * height;
            boy.position.copy(flat);
            // tuck legs / swing arms during the hop
            const swing = Math.sin(Math.PI * p);
            boy.userData.lL.rotation.x = -swing * 0.9;
            boy.userData.lR.rotation.x = swing * 0.9;
            boy.userData.aL.rotation.z = 0.35 + swing * 0.6;
            boy.userData.aR.rotation.z = -0.35 - swing * 0.6;
        },
        done() {
            boy.position.copy(toPos);
            boy.userData.lL.rotation.x = 0; boy.userData.lR.rotation.x = 0;
            boy.userData.aL.rotation.z = 0.35; boy.userData.aR.rotation.z = -0.35;
        }
    };
}

// short pause
function waitAction(dur) {
    return { dur, init() {}, update() {}, done() {} };
}

// the tile under the boy crumbles, then he plummets
function crumbleAction(tileIdx) {
    const tile = tileMeshes[tileIdx - 1];
    return {
        dur: 0.7,
        init() {},
        update(p) {
            if (tile) {
                tile.position.y = tile.userData.baseY - p * 1.2;
                tile.rotation.z = p * 0.5;
                tile.material.opacity = 1 - p;
                tile.material.transparent = true;
                if (tile.userData.label) tile.userData.label.material.opacity = 1 - p;
            }
            boy.position.y -= p * 0.15;
        },
        done() {}
    };
}

// free fall into the abyss (tumbling). `vel` is an optional horizontal launch velocity.
function fallAction(vel) {
    const vx = vel ? vel.x : 0;
    const vz = vel ? vel.z : 0;
    let vy = vel ? 4 : 0;
    return {
        dur: 2.2,
        init() {},
        update(p, dt) {
            vy -= 22 * dt;
            boy.position.y += vy * dt;
            boy.position.x += vx * dt;
            boy.position.z += vz * dt;
            boy.rotation.x += dt * 6;
            boy.rotation.z += dt * 3;
        },
        done() { boy.visible = false; }
    };
}

// happy victory bounce on the target tile
function celebrateAction() {
    let baseY = 0;
    return {
        dur: 1.4,
        init() { baseY = boy.position.y; },
        update(p) {
            boy.position.y = baseY + Math.abs(Math.sin(p * Math.PI * 3)) * 0.6;
            boy.userData.aL.rotation.z = 0.35 + Math.sin(p * Math.PI * 6) * 0.8 + 0.6;
            boy.userData.aR.rotation.z = -0.35 - Math.sin(p * Math.PI * 6) * 0.8 - 0.6;
            boy.rotation.y += 0.12;
        },
        done() { boy.position.y = baseY; }
    };
}

// fired once the whole sequence finishes
function finishAction(win, desc) {
    return {
        dur: 0.01,
        init() {
            busy = false;
            dom.resTitle.textContent = win ? 'YOU MADE IT! 🌟' : 'INTO THE ABYSS! 💀';
            dom.resTitle.className = 'res-title ' + (win ? 'win' : 'fail');
            dom.resDesc.textContent = desc;
            dom.result.classList.add('show');
        },
        update() {}, done() {}
    };
}

// ─── Run a guess ─────────────────────────────────────
const HOP_H = 1.8, HOP_DUR = 0.55;

function runGuess(guess) {
    busy = true;
    dom.answerPanel.classList.add('hidden');

    let cur = 0;   // 0 = START pad; landings are the multiples jumpSize, 2*jumpSize, …
    let overshoot = false;

    for (let k = 0; k < guess; k++) {
        const next = cur + jumpSize;
        if (next > targetTile) {
            // No tile out there — leap forward into empty space, then fall.
            const dir = posForIndex(cur).clone().sub(posForIndex(cur - jumpSize));
            dir.y = 0; dir.normalize();
            const phantom = standPos(cur).add(dir.clone().multiplyScalar(SP * ROW_GAP * 1.1)).add(new THREE.Vector3(0, 0.4, 0));
            enqueue(hopAction(phantom, HOP_H, HOP_DUR));
            enqueue(fallAction(dir.multiplyScalar(4)));
            overshoot = true;
            break;
        }
        enqueue(hopAction(standPos(next), HOP_H, HOP_DUR));
        cur = next;
    }

    if (overshoot) {
        enqueue(finishAction(false,
            `You jumped too many times! Tile ${targetTile} is the last one — there was nothing beyond it to land on. It takes ${correctJumps} jumps, since ${targetTile} ÷ ${jumpSize} = ${correctJumps}.`));
    } else if (cur === targetTile) {
        enqueue(celebrateAction());
        enqueue(finishAction(true,
            `Perfect! ${correctJumps} jumps × ${jumpSize} = ${targetTile}, landing right on tile ${targetTile}.`));
    } else {
        // landed short of the target → the tile gives way
        enqueue(waitAction(0.35));
        enqueue(crumbleAction(cur));
        enqueue(fallAction(null));
        enqueue(finishAction(false,
            `So close — you stopped on tile ${cur}, short of ${targetTile}. You needed ${correctJumps} jumps (${targetTile} ÷ ${jumpSize} = ${correctJumps}), not ${guess}.`));
    }
}

// ─── Input handlers ──────────────────────────────────
dom.btnStart.addEventListener('click', () => {
    started = true;
    newRound();
    dom.startScreen.classList.add('hidden');
    dom.answerPanel.classList.remove('hidden');
    dom.answerInput.focus();
});

dom.btnCheck.addEventListener('click', () => {
    if (busy || !started) return;
    const guess = parseInt(dom.answerInput.value, 10);
    if (isNaN(guess) || guess < 1) return;
    runGuess(guess);
});

dom.answerInput.addEventListener('keydown', e => { if (e.key === 'Enter') dom.btnCheck.click(); });

dom.btnNext.addEventListener('click', () => {
    dom.result.classList.remove('show');
    newRound();
    dom.answerPanel.classList.remove('hidden');
    dom.answerInput.focus();
});

// ─── Idle camera before start ────────────────────────
buildPath();
boy.visible = false;
camFollow.copy(standPos(0));
snapCamera();

// ─── Main loop ───────────────────────────────────────
// Tiles are kept perfectly still so the boy always lands exactly on top of them.
const clock = new THREE.Clock();
function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);

    // process the animation queue
    if (!action && queue.length) {
        action = queue.shift();
        action.t = 0;
        action.init();
    }
    if (action) {
        action.t += dt;
        const p = Math.min(1, action.t / action.dur);
        action.update(p, dt);
        if (p >= 1) { action.done(); action = null; }
    }

    // camera follows the boy while he is visible
    if (boy.visible) camFollow.lerp(boy.position, Math.min(1, dt * 3));
    camera.position.lerp(desiredCamPos(), Math.min(1, dt * 3));
    camera.lookAt(camFollow.x, camFollow.y + 0.6, camFollow.z);

    composer.render();
}
loop();
