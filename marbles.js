import * as THREE from 'three';

let scene, camera, renderer;
let jarsGroup = new THREE.Group();

const uiPromptColor = document.getElementById('target-color-name');
const uiScore = document.getElementById('score');
const uiBtnA = document.getElementById('btn-jar-a');
const uiBtnB = document.getElementById('btn-jar-b');
const notifyEl = document.getElementById('notify');
const notifyText = document.getElementById('notify-text');

let score = 0;
let targetColorObj = null;
let jarAProb = 0;
let jarBProb = 0;

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playTone(freq, type, duration, vol=0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playSuccess() {
    playTone(400, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(600, 'sine', 0.1, 0.1), 100);
    setTimeout(() => playTone(800, 'sine', 0.3, 0.1), 200);
}

function playError() {
    playTone(150, 'sawtooth', 0.3, 0.1);
}

const colors = [
    { name: 'RED', hex: 0xef4444, html: '#ef4444' },
    { name: 'BLUE', hex: 0x3b82f6, html: '#3b82f6' },
    { name: 'GREEN', hex: 0x10b981, html: '#10b981' },
    { name: 'YELLOW', hex: 0xeab308, html: '#eab308' }
];

init();
animate();

function init() {
    const canvas = document.querySelector('#c');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 5, 20);
    camera.lookAt(0, 0, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 1);
    backLight.position.set(-5, 10, -7);
    scene.add(backLight);

    // Table surface
    const planeGeo = new THREE.PlaneGeometry(50, 50);
    const planeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.2 });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -3;
    scene.add(plane);

    scene.add(jarsGroup);

    generateRound();

    window.addEventListener('resize', onWindowResize);

    uiBtnA.addEventListener('click', () => checkAnswer('A'));
    uiBtnB.addEventListener('click', () => checkAnswer('B'));
}

function createJar(xOffset, counts) {
    const group = new THREE.Group();
    group.position.set(xOffset, 0, 0);

    // Glass Jar Material
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.9, // glass-like
        transparent: true,
        thickness: 0.5
    });

    // Jar Body
    const jarGeo = new THREE.CylinderGeometry(2, 2, 6, 32);
    const jarMesh = new THREE.Mesh(jarGeo, glassMat);
    group.add(jarMesh);

    // Jar Base
    const baseGeo = new THREE.CylinderGeometry(2.1, 2.1, 0.2, 32);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -3.1;
    group.add(baseMesh);

    // Marbles
    const marbleRadius = 0.4;
    const marbleGeo = new THREE.SphereGeometry(marbleRadius, 32, 32);
    
    // We will place marbles semi-randomly, stacking them up from bottom
    let marbleIndex = 0;
    
    let totalMarbles = 0;
    Object.values(counts).forEach(c => totalMarbles += c);
    
    // Simple packing: fill from bottom to top in layers
    let yPos = -2.8 + marbleRadius;
    let placedInLayer = 0;
    let maxInLayer = 7;
    
    // Flatten counts into an array of colors and shuffle
    let colorArray = [];
    Object.entries(counts).forEach(([colorName, count]) => {
        let colObj = colors.find(c => c.name === colorName);
        for(let i=0; i<count; i++) colorArray.push(colObj.hex);
    });
    
    // Shuffle
    colorArray.sort(() => Math.random() - 0.5);

    colorArray.forEach(hexColor => {
        const marbleMat = new THREE.MeshStandardMaterial({ 
            color: hexColor, 
            roughness: 0.2, 
            metalness: 0.3 
        });
        const marble = new THREE.Mesh(marbleGeo, marbleMat);
        
        // Find position in current layer
        let angle = Math.random() * Math.PI * 2;
        let radius = Math.random() * 1.2; // keep inside jar
        
        marble.position.set(
            Math.cos(angle) * radius,
            yPos + (Math.random()*0.2 - 0.1), // slight jitter
            Math.sin(angle) * radius
        );
        
        group.add(marble);
        
        placedInLayer++;
        if (placedInLayer >= maxInLayer) {
            placedInLayer = 0;
            yPos += marbleRadius * 2 * 0.85; // Move up a layer
        }
    });

    return group;
}

function generateRound() {
    // Clear old jars
    jarsGroup.clear();

    // Generate random counts for Jar A
    let totalA = Math.floor(Math.random() * 10) + 10; // 10 to 19 marbles
    let countsA = { RED: 0, BLUE: 0, GREEN: 0, YELLOW: 0 };
    for(let i=0; i<totalA; i++) countsA[colors[Math.floor(Math.random() * colors.length)].name]++;
    
    // Generate random counts for Jar B
    let totalB = Math.floor(Math.random() * 10) + 10;
    let countsB = { RED: 0, BLUE: 0, GREEN: 0, YELLOW: 0 };
    for(let i=0; i<totalB; i++) countsB[colors[Math.floor(Math.random() * colors.length)].name]++;

    // Pick a target color that exists in at least one jar
    let availableColors = colors.filter(c => countsA[c.name] > 0 || countsB[c.name] > 0);
    targetColorObj = availableColors[Math.floor(Math.random() * availableColors.length)];

    jarAProb = countsA[targetColorObj.name] / totalA;
    jarBProb = countsB[targetColorObj.name] / totalB;

    // If probabilities are exactly equal, re-roll
    if (Math.abs(jarAProb - jarBProb) < 0.001) {
        return generateRound();
    }

    // Create 3D Jars
    const jarA = createJar(-5, countsA);
    const jarB = createJar(5, countsB);
    jarsGroup.add(jarA);
    jarsGroup.add(jarB);

    // Update UI
    uiPromptColor.innerText = targetColorObj.name;
    uiPromptColor.style.color = targetColorObj.html;
}

function checkAnswer(selection) {
    let isCorrect = false;

    if (selection === 'A' && jarAProb > jarBProb) isCorrect = true;
    if (selection === 'B' && jarBProb > jarAProb) isCorrect = true;

    if (isCorrect) {
        // Correct
        playSuccess();
        document.body.classList.add('flash-green');
        setTimeout(() => document.body.classList.remove('flash-green'), 500);
        
        score += 10;
        uiScore.innerText = score;
        showNotification('Correct! 🎉', '#10b981');
        
        // Confetti
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });

        generateRound();
    } else {
        // Wrong
        playError();
        document.body.classList.add('flash-red');
        setTimeout(() => document.body.classList.remove('flash-red'), 500);
        
        score = Math.max(0, score - 5);
        uiScore.innerText = score;
        showNotification('Oops, wrong jar! ❌', '#ef4444');
    }
}

function showNotification(msg, color) {
    notifyText.innerText = msg;
    notifyText.style.color = color;
    notifyEl.classList.add('show');
    setTimeout(() => {
        notifyEl.classList.remove('show');
    }, 2000);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    // Slight rotation to show 3D depth of jars
    if (jarsGroup.children.length > 0) {
        jarsGroup.children[0].rotation.y += 0.005;
        jarsGroup.children[1].rotation.y -= 0.005;
    }
    
    renderer.render(scene, camera);
}
