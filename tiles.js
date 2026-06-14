// =====================================================
// Tile Math 3D — how many tiles fill the floor?
// =====================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ─── DOM ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const canvas = $('c');
const dom = {
    sFloor: $('s-floor'),
    sTile: $('s-tile'),
    modeScreen: $('mode-screen'),
    hint: $('hint'),
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
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.FogExp2(0x1a1a2e, 0.012);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.5, 0.85));

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Lighting ────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x404060, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(8, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
scene.add(sun);

// Big dark ground plane underneath everything
const ground = new THREE.Mesh(
    new THREE.CircleGeometry(60, 64),
    new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.9 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.4;
ground.receiveShadow = true;
scene.add(ground);

// ─── Text sprite helper (for 3D dimension labels) ────
function makeTextSprite(text, color = '#ffffff') {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const ctx = c.getContext('2d');
    // Shrink the font until the text fits the canvas width
    let fontSize = 90;
    do {
        ctx.font = `900 ${fontSize}px "Outfit", Arial, sans-serif`;
        if (ctx.measureText(text).width <= c.width - 40) break;
        fontSize -= 6;
    } while (fontSize > 20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, c.width / 2, 70);
    ctx.fillStyle = color;
    ctx.fillText(text, c.width / 2, 70);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c), transparent: true, depthTest: false
    }));
    sprite.scale.set(6, 1.5, 1); // matches 512x128 canvas aspect
    sprite.renderOrder = 5;
    return sprite;
}

// ─── Round state ─────────────────────────────────────
const roundGroup = new THREE.Group();
scene.add(roundGroup);

let mode = 0;            // 1 = place & count, 2 = predict
let floorW = 0, floorD = 0;   // floor size in units
let tileW = 1, tileD = 1;     // tile size in units
let correctAnswer = 0;
let busy = false;        // true while fill animation runs
const placedTiles = new Map(); // mode 1: "x,z" -> mesh
const fallingTiles = [];       // tiles animating downward

const TILE_H = 0.22;
const tileMat1 = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.4, metalness: 0.1, emissive: 0x7c3aed, emissiveIntensity: 0.12 });
const tileMat2 = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.4, metalness: 0.1, emissive: 0x06b6d4, emissiveIntensity: 0.12 });

function clearRound() {
    while (roundGroup.children.length) {
        const o = roundGroup.children.pop();
        roundGroup.remove(o);
    }
    placedTiles.clear();
    fallingTiles.length = 0;
    stackTiles.length = 0;
    dragTile = null;
}

// Cell center → world position (floor centered at origin)
function cellToWorld(cx, cz, w = 1, d = 1) {
    return new THREE.Vector3(
        -floorW / 2 + cx + w / 2,
        TILE_H / 2 + 0.01,
        -floorD / 2 + cz + d / 2
    );
}

function makeTile(w, d, mat) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, TILE_H, d - 0.08), mat);
    t.castShadow = true;
    t.receiveShadow = true;
    return t;
}

// ─── Build the floor ─────────────────────────────────
let floorMesh = null;

function buildFloor() {
    // Floor slab
    floorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(floorW, 0.3, floorD),
        new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.85 })
    );
    floorMesh.position.y = -0.15;
    floorMesh.receiveShadow = true;
    roundGroup.add(floorMesh);

    // Grid lines on top of the floor
    const lineMat = new THREE.LineBasicMaterial({ color: 0x8a7a55 });
    const pts = [];
    for (let x = 0; x <= floorW; x++) {
        pts.push(new THREE.Vector3(-floorW/2 + x, 0.012, -floorD/2), new THREE.Vector3(-floorW/2 + x, 0.012, floorD/2));
    }
    for (let z = 0; z <= floorD; z++) {
        pts.push(new THREE.Vector3(-floorW/2, 0.012, -floorD/2 + z), new THREE.Vector3(floorW/2, 0.012, -floorD/2 + z));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    roundGroup.add(new THREE.LineSegments(lineGeo, lineMat));

    // 3D dimension labels at the floor edges
    const wLabel = makeTextSprite(`${floorW}`, '#a78bfa');
    wLabel.position.set(0, 0.6, floorD / 2 + 1.2);
    roundGroup.add(wLabel);
    const dLabel = makeTextSprite(`${floorD}`, '#a78bfa');
    dLabel.position.set(-floorW / 2 - 1.4, 0.6, 0);
    roundGroup.add(dLabel);

    // Camera fits the floor
    const maxDim = Math.max(floorW, floorD);
    camera.position.set(0, maxDim * 1.5 + 5, maxDim * 1.1 + 5);
    camera.lookAt(0, 0, 0);

    dom.sFloor.textContent = `${floorW} × ${floorD}`;
    dom.sTile.textContent = `${tileW} × ${tileD}`;
}

// Sample tile shown floating next to the floor (mode 2)
function buildSampleTile() {
    const sample = makeTile(tileW, tileD, tileMat2);
    sample.position.set(floorW / 2 + tileW / 2 + 2, TILE_H / 2 + 0.6, 0);
    roundGroup.add(sample);
    const lbl = makeTextSprite(`${tileW}×${tileD}`, '#67e8f9');
    lbl.position.copy(sample.position).add(new THREE.Vector3(0, 1.4, 0));
    lbl.scale.set(3, 0.75, 1);
    roundGroup.add(lbl);
}

// ─── Mode setup ──────────────────────────────────────
const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function startMode1() {
    mode = 1;
    clearRound();
    tileW = 1; tileD = 1;
    floorW = rnd(3, 6);
    floorD = rnd(3, 6);
    correctAnswer = floorW * floorD;
    buildFloor();
    buildStack();

    dom.modeScreen.classList.add('hidden');
    dom.hint.classList.remove('hidden');
    dom.apQuestion.textContent = `Floor is ${floorW} × ${floorD}, each tile is ${tileW} × ${tileD}. Tiles needed to cover the whole floor = ___`;
    dom.answerInput.value = '';
    dom.answerPanel.classList.remove('hidden');
}

const TILE_OPTIONS = [[1,1],[2,1],[2,2],[3,1],[3,2]];

function startMode2() {
    mode = 2;
    clearRound();
    [tileW, tileD] = TILE_OPTIONS[Math.floor(Math.random() * TILE_OPTIONS.length)];
    floorW = tileW * rnd(2, 4);
    floorD = tileD * rnd(2, 4);
    correctAnswer = (floorW / tileW) * (floorD / tileD);
    buildFloor();
    buildSampleTile();

    dom.modeScreen.classList.add('hidden');
    dom.hint.classList.add('hidden');
    dom.apQuestion.textContent = `Floor is ${floorW} × ${floorD}, each tile is ${tileW} × ${tileD}. How many tiles will fit?`;
    dom.answerInput.value = '';
    dom.answerPanel.classList.remove('hidden');
}

// ─── Mode 1: stack of tiles, drag & drop onto floor ──
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const stackTiles = [];
let dragTile = null;
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2); // hover height y = 1.2
const dragPoint = new THREE.Vector3();

// Build a pile of tiles next to the floor (columns of 8)
function buildStack() {
    stackTiles.length = 0;
    const count = floorW * floorD;
    const baseX = floorW / 2 + 2.2;
    for (let i = 0; i < count; i++) {
        const col = Math.floor(i / 8);
        const lvl = i % 8;
        const t = makeTile(1, 1, tileMat1);
        t.position.set(
            baseX + col * 1.3,
            TILE_H / 2 + lvl * (TILE_H + 0.03),
            floorD / 2 - 0.5
        );
        t.userData.home = t.position.clone();
        roundGroup.add(t);
        stackTiles.push(t);
    }

    // Label the tile size above the stack
    const lbl = makeTextSprite(`Tile ${tileW}×${tileD}`, '#c4b5fd');
    lbl.position.set(baseX + (Math.ceil(count / 8) - 1) * 0.65, TILE_H / 2 + 8 * (TILE_H + 0.03) + 0.8, floorD / 2 - 0.5);
    lbl.scale.set(3.2, 0.8, 1); // keep 4:1 canvas aspect so text isn't squashed
    roundGroup.add(lbl);
}

function setRay(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
}

canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 1 || busy || dragTile) return;
    setRay(e);

    // Grab a tile already placed on the floor (to move it back / elsewhere)
    const placedArr = [...placedTiles.values()];
    let hit = raycaster.intersectObjects(placedArr)[0];
    if (hit) {
        dragTile = hit.object;
        for (const [k, v] of placedTiles) if (v === dragTile) placedTiles.delete(k);
        return;
    }

    // Grab from the stack: pick the topmost tile of the touched column
    hit = raycaster.intersectObjects(stackTiles)[0];
    if (hit) {
        const col = hit.object.userData.home;
        let top = null;
        for (const t of stackTiles) {
            if (Math.abs(t.userData.home.x - col.x) < 0.01 && (!top || t.position.y > top.position.y)) top = t;
        }
        dragTile = top;
        stackTiles.splice(stackTiles.indexOf(top), 1);
    }
});

canvas.addEventListener('pointermove', (e) => {
    if (!dragTile) return;
    setRay(e);
    if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) dragTile.position.copy(dragPoint);
});

window.addEventListener('pointerup', (e) => {
    if (!dragTile) return;
    setRay(e);
    let placed = false;
    const hit = raycaster.intersectObject(floorMesh)[0];
    if (hit) {
        const cx = Math.floor(hit.point.x + floorW / 2);
        const cz = Math.floor(hit.point.z + floorD / 2);
        const key = `${cx},${cz}`;
        if (cx >= 0 && cx < floorW && cz >= 0 && cz < floorD && !placedTiles.has(key)) {
            dragTile.position.copy(cellToWorld(cx, cz));
            placedTiles.set(key, dragTile);
            placed = true;
        }
    }
    if (!placed) {
        // Snap back onto the stack
        dragTile.position.copy(dragTile.userData.home);
        stackTiles.push(dragTile);
    }
    dragTile = null;
});

// ─── Fill animation (drops tiles one by one) ─────────
function fillFloor(onDone) {
    busy = true;
    const positions = [];
    for (let z = 0; z < floorD; z += tileD) {
        for (let x = 0; x < floorW; x += tileW) {
            if (mode === 1 && placedTiles.has(`${x},${z}`)) continue; // already placed by player
            positions.push([x, z]);
        }
    }
    let i = 0;
    const timer = setInterval(() => {
        if (i >= positions.length) {
            clearInterval(timer);
            // wait for last tiles to land
            setTimeout(() => { busy = false; onDone(); }, 600);
            return;
        }
        const [x, z] = positions[i++];
        // In mode 1 the remaining tiles fly off the stack; otherwise spawn new ones
        let t = (mode === 1 && stackTiles.length) ? stackTiles.pop() : makeTile(tileW, tileD, mode === 1 ? tileMat1 : tileMat2);
        const target = cellToWorld(x, z, tileW, tileD);
        t.position.copy(target).setY(target.y + 8);
        t.userData.targetY = target.y;
        roundGroup.add(t);
        fallingTiles.push(t);
    }, 110);
}

// ─── Answer checking ─────────────────────────────────
function showResult(win, desc) {
    dom.resTitle.textContent = win ? 'CORRECT!' : 'WRONG — YOU FAIL!';
    dom.resTitle.className = 'res-title ' + (win ? 'win' : 'fail');
    dom.resDesc.textContent = desc;
    dom.result.classList.add('show');
}

dom.btnCheck.addEventListener('click', () => {
    if (busy) return;
    const guess = parseInt(dom.answerInput.value, 10);
    if (isNaN(guess)) return;

    dom.answerPanel.classList.add('hidden');
    dom.hint.classList.add('hidden');

    // The app now tries to fit the tiles in
    fillFloor(() => {
        if (guess === correctAnswer) {
            showResult(true, `Exactly right — it took ${correctAnswer} tiles to fill the ${floorW} × ${floorD} floor!`);
        } else {
            showResult(false, `You said ${guess}, but it actually took ${correctAnswer} tiles (${floorW} × ${floorD} floor, ${tileW} × ${tileD} tiles).`);
        }
    });
});

dom.answerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') dom.btnCheck.click();
});

dom.btnNext.addEventListener('click', () => {
    dom.result.classList.remove('show');
    clearRound();
    mode = 0;
    dom.sFloor.textContent = '-';
    dom.sTile.textContent = '-';
    dom.modeScreen.classList.remove('hidden');
});

$('btn-mode1').addEventListener('click', startMode1);
$('btn-mode2').addEventListener('click', startMode2);

// ─── Idle scene before a mode is picked ──────────────
camera.position.set(0, 10, 12);
camera.lookAt(0, 0, 0);

// ─── Main loop ───────────────────────────────────────
const clock = new THREE.Clock();

function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);

    // Animate falling tiles
    for (let i = fallingTiles.length - 1; i >= 0; i--) {
        const t = fallingTiles[i];
        t.position.y += (t.userData.targetY - t.position.y) * Math.min(1, dt * 10);
        if (t.position.y - t.userData.targetY < 0.005) {
            t.position.y = t.userData.targetY;
            fallingTiles.splice(i, 1);
        }
    }

    composer.render();
}

loop();
