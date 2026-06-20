// =====================================================
// Cosmic Jumper 3D — how many jumps to reach the target tile?
// A man hops along a straight line of tiles floating in space,
// advancing a fixed number of tiles per jump. Too few jumps and
// he's stuck (game over); too many and he leaps off the end into
// the abyss; exactly right and he lands on the target tile.
// =====================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
scene.fog = new THREE.FogExp2(0x05060f, 0.010);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1200);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Image-based lighting for soft, realistic reflections on the tiles & character
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// Deep-space nebula gradient as the backdrop
scene.background = (function makeGradientBg() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, '#1b1146');
    g.addColorStop(0.35, '#130c33');
    g.addColorStop(0.7, '#0a0820');
    g.addColorStop(1.0, '#04030c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
})();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.75, 0.7, 0.8);
composer.addPass(bloom);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Lighting ────────────────────────────────────────
scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x251a4d, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(8, 26, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 140;
sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
sun.shadow.bias = -0.0004;
sun.shadow.radius = 4;
scene.add(sun);
// Colored rim lights for a richer, more cinematic look
const rimA = new THREE.PointLight(0x38bdf8, 2.2, 120, 1.6);
rimA.position.set(-16, 10, 10);
scene.add(rimA);
const rimB = new THREE.PointLight(0xf472b6, 1.6, 120, 1.6);
rimB.position.set(18, 6, -8);
scene.add(rimB);

// ─── Starfield (two layers: faint dust + brighter colored stars) ──
function makeStarLayer(count, size, spread, opacity, tint) {
    const pos = new Float32Array(count * 3);
    const colArr = new Float32Array(count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
        const r = 90 + Math.random() * spread;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
        pos[i*3+1] = (Math.random() * 2 - 0.5) * 160;
        pos[i*3+2] = r * Math.sin(ph) * Math.sin(th) - 40;
        col.setHSL(tint + Math.random() * 0.12, 0.55, 0.55 + Math.random() * 0.45);
        col.toArray(colArr, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    const m = new THREE.PointsMaterial({ size, sizeAttenuation: true, transparent: true, opacity, vertexColors: true, depthWrite: false });
    const pts = new THREE.Points(g, m);
    scene.add(pts);
    return pts;
}
makeStarLayer(1600, 0.9, 360, 0.7, 0.58);   // faint blue dust
makeStarLayer(280, 2.2, 320, 1.0, 0.05);    // brighter warm stars (glow via bloom)

// ─── Text sprite helper (tile numbers) ───────────────
function makeTextSprite(text, color = '#ffffff', bold = true) {
    const measure = document.createElement('canvas').getContext('2d');
    const fontSize = 150;
    measure.font = `${bold ? 900 : 600} ${fontSize}px "Outfit", Arial, sans-serif`;
    const pad = 30;
    const w = Math.max(256, Math.ceil(measure.measureText(text).width) + pad * 2);
    const h = 256;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.font = `${bold ? 900 : 600} ${fontSize}px "Outfit", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 18;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, w / 2, h / 2 + 10);
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2 + 10);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c), transparent: true, depthTest: false
    }));
    sprite.renderOrder = 5;
    sprite.userData.aspect = w / h;
    return sprite;
}

// ─── Game constants ──────────────────────────────────
const SP = 2.4;             // gap between tiles along the line (left → right)
// Man's feet rest exactly on the top face of a tile.
// Tile box is 0.4 tall (top = centre + 0.2); the man's feet sit ~0.03 below his origin.
const FEET_OFFSET = 0.23;
// The man jumps in steps of jumpSize tiles; target = jumpSize * jumps (always a multiple).
const JUMP_CHOICES = [2, 3, 4, 5, 6, 7, 8];
const JUMPS_MIN = 4, JUMPS_MAX = 11;

// Tile index (1-based) → world position of its centre.
// Tiles form a single straight horizontal line running left → right.
function tilePos(i) {
    return new THREE.Vector3(i * SP, 0, 0);
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

// ─── Build the man ───────────────────────────────────
const boy = new THREE.Group();
(function buildBoy() {
    const skin  = new THREE.MeshStandardMaterial({ color: 0xf2c197, roughness: 0.55, metalness: 0.0, envMapIntensity: 0.8 });
    const shirt = new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.4, emissive: 0x0a3a55, emissiveIntensity: 0.35, envMapIntensity: 1.0 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2b3650, roughness: 0.6, metalness: 0.1, envMapIntensity: 0.9 });
    const shoes = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.2, envMapIntensity: 1.0 });
    const hair  = new THREE.MeshStandardMaterial({ color: 0x241c16, roughness: 0.75 });
    const eyeW  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const eyeB  = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });

    // legs + shoes
    const legGeo = new THREE.CapsuleGeometry(0.13, 0.4, 6, 12);
    const lL = new THREE.Mesh(legGeo, pants); lL.position.set(-0.15, 0.3, 0);
    const lR = new THREE.Mesh(legGeo, pants); lR.position.set(0.15, 0.3, 0);
    const shoeGeo = new THREE.SphereGeometry(0.16, 12, 10);
    const sL = new THREE.Mesh(shoeGeo, shoes); sL.position.set(-0.15, 0.05, 0.06); sL.scale.set(1, 0.7, 1.4);
    const sR = new THREE.Mesh(shoeGeo, shoes); sR.position.set(0.15, 0.05, 0.06); sR.scale.set(1, 0.7, 1.4);
    // body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.45, 6, 16), shirt);
    body.position.y = 0.85;
    // arms
    const armGeo = new THREE.CapsuleGeometry(0.1, 0.42, 6, 12);
    const aL = new THREE.Mesh(armGeo, shirt); aL.position.set(-0.36, 0.92, 0); aL.rotation.z = 0.35;
    const aR = new THREE.Mesh(armGeo, shirt); aR.position.set(0.36, 0.92, 0); aR.rotation.z = -0.35;
    // head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 28, 28), skin);
    head.position.y = 1.42;
    const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 28, 28, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
    hairMesh.position.y = 1.46;
    // face (eyes look toward +Z, the man's forward/travel direction)
    const face = new THREE.Group();
    for (const sx of [-0.1, 0.1]) {
        const w = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), eyeW);
        w.position.set(sx, 1.45, 0.24); w.scale.set(1, 1.2, 0.6);
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), eyeB);
        b.position.set(sx, 1.45, 0.28);
        face.add(w, b);
    }

    boy.add(lL, lR, sL, sR, body, aL, aR, head, hairMesh, face);
    boy.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.base = o.position.clone(); } });
    boy.userData = { lL, lR, aL, aR, body };
})();
scene.add(boy);

// ─── Build the straight line of tiles ────────────────
function buildPath() {
    while (pathGroup.children.length) pathGroup.remove(pathGroup.children.pop());
    tileMeshes.length = 0;

    const baseMat = new THREE.MeshPhysicalMaterial({ color: 0x6d4ed6, roughness: 0.3, metalness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25, emissive: 0x2a1c5c, emissiveIntensity: 0.55, envMapIntensity: 1.1 });
    const startMat = new THREE.MeshPhysicalMaterial({ color: 0x10b981, roughness: 0.28, metalness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25, emissive: 0x065f46, emissiveIntensity: 0.7, envMapIntensity: 1.1 });
    const targetMat = new THREE.MeshPhysicalMaterial({ color: 0xf59e0b, roughness: 0.22, metalness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: 0xb4720a, emissiveIntensity: 1.1, envMapIntensity: 1.2 });
    const tileGeo = new THREE.BoxGeometry(2.0, 0.4, 2.0);

    // START launch pad (index 0), one step before tile 1
    const pad = new THREE.Mesh(tileGeo, startMat);
    pad.position.copy(startPadPos());
    pad.castShadow = true;
    pad.receiveShadow = true;
    pathGroup.add(pad);
    const padLbl = makeTextSprite('START', '#a7f3d0');
    padLbl.scale.set(0.85 * padLbl.userData.aspect, 0.85, 1);
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
        lbl.scale.set(1.1 * lbl.userData.aspect, 1.1, 1);
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
        `The man can jump <b>${jumpSize}</b> tiles in each jump. ` +
        `How many jumps are required to reach tile&nbsp;<span>${targetTile}</span>?`;
    dom.answerInput.value = '';

    camFollow.copy(boy.position);
    snapCamera();
}

// ─── Camera follow ───────────────────────────────────
const camFollow = new THREE.Vector3();
const camOffset = new THREE.Vector3(0, 3.4, 12);   // in front & slightly above, line runs left→right
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

// The boy can't reach the target — he stays on his tile, looks toward the
// far-off target and gives a disappointed slump. No falling.
function stuckAction() {
    let baseY = 0;
    return {
        dur: 1.1,
        init() { baseY = boy.position.y; },
        update(p) {
            // small teeter then a shrug/slump
            const t = Math.sin(p * Math.PI);
            boy.rotation.z = Math.sin(p * Math.PI * 4) * 0.12 * (1 - p);
            boy.userData.aL.rotation.z = 0.35 + t * 0.5;
            boy.userData.aR.rotation.z = -0.35 - t * 0.5;
            boy.position.y = baseY - t * 0.08;   // little slump, stays on tile
        },
        done() { boy.rotation.z = 0; boy.position.y = baseY; }
    };
}

// the man leaps past the final tile and tumbles into the abyss
function fallAction(vel) {
    const vx = vel ? vel.x : 0;
    const vz = vel ? vel.z : 0;
    let vy = 5;
    return {
        dur: 2.4,
        init() {},
        update(p, dt) {
            vy -= 24 * dt;
            boy.position.x += vx * dt;
            boy.position.y += vy * dt;
            boy.position.z += vz * dt;
            boy.rotation.x += dt * 7;
            boy.rotation.z += dt * 4;
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
function finishAction(win, desc, title) {
    return {
        dur: 0.01,
        init() {
            busy = false;
            dom.resTitle.textContent = title || (win ? 'YOU MADE IT! 🌟' : 'GAME OVER');
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
    let overshoot = false;   // a jump goes past the final tile → leap into empty space & fall

    for (let k = 0; k < guess; k++) {
        const next = cur + jumpSize;
        if (next > targetTile) {
            // There's no tile out here — the man leaps forward off the end and falls.
            const dir = posForIndex(cur).clone().sub(posForIndex(cur - jumpSize));
            dir.y = 0; dir.normalize();
            const phantom = standPos(cur).add(dir.clone().multiplyScalar(SP * jumpSize * 0.5)).add(new THREE.Vector3(0, 0.5, 0));
            enqueue(hopAction(phantom, HOP_H * 1.3, HOP_DUR));
            enqueue(fallAction(dir.multiplyScalar(5)));
            overshoot = true;
            break;
        }
        enqueue(hopAction(standPos(next), HOP_H, HOP_DUR));
        cur = next;
    }

    if (!overshoot && cur === targetTile && guess === correctJumps) {
        enqueue(celebrateAction());
        enqueue(finishAction(true,
            `Perfect! ${correctJumps} jumps × ${jumpSize} = ${targetTile}, landing right on tile ${targetTile}.`));
    } else if (overshoot) {
        // too many jumps: he leaps past the last tile into the abyss
        enqueue(finishAction(false,
            `Too many jumps! He leapt past tile ${targetTile} into the abyss. It only takes ${correctJumps} jumps (${targetTile} ÷ ${jumpSize} = ${correctJumps}), not ${guess}.`,
            'INTO THE ABYSS! 💀'));
    } else {
        // too few jumps: he stays put on the tile he reached, short of the target
        enqueue(stuckAction());
        enqueue(finishAction(false,
            `Not enough jumps — he's stuck on tile ${cur}, short of ${targetTile}. It takes ${correctJumps} jumps (${targetTile} ÷ ${jumpSize} = ${correctJumps}), not ${guess}. Game over.`));
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
