import * as THREE from 'three';

let scene, camera, renderer;
let playerCar, pcCar;
let finishLine;

let playerSteps = 0;
let pcSteps = 0;
const MAX_STEPS = 10;
const STEP_DISTANCE = 10;

let currentAnswer = 0;
let isPlaying = false;
let pcTimer = null;
let lastTime = 0;
let score = 0;

// UI Elements
const uiOverlay = document.getElementById('start-overlay');
const uiBtnStart = document.getElementById('btn-start');
const uiTitle = document.getElementById('game-end-title');
const uiQuestion = document.getElementById('question-text');
const uiInput = document.getElementById('answer-input');
const uiSubmit = document.getElementById('btn-submit');
const uiPlayerProgress = document.getElementById('player-progress');
const uiPcProgress = document.getElementById('pc-progress');

init();
animate();

function init() {
    const canvas = document.querySelector('#c');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#87CEEB'); // Sky blue
    scene.fog = new THREE.FogExp2('#87CEEB', 0.005);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Environment (Road and Ground)
    createEnvironment();

    // Cars
    playerCar = createCar('#3b82f6'); // Blue
    playerCar.position.set(-2, 0, 0);
    scene.add(playerCar);

    pcCar = createCar('#ef4444'); // Red
    pcCar.position.set(2, 0, 0);
    scene.add(pcCar);

    // Finish Line
    createFinishLine();

    // Events
    window.addEventListener('resize', onWindowResize);
    uiBtnStart.addEventListener('click', startGame);
    uiSubmit.addEventListener('click', checkAnswer);
    uiInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
}

function createEnvironment() {
    // Ground
    const groundGeo = new THREE.PlaneGeometry(500, 500);
    const groundMat = new THREE.MeshPhongMaterial({ color: '#4ade80' }); // Green grass
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);

    // Road
    const roadGeo = new THREE.PlaneGeometry(12, MAX_STEPS * STEP_DISTANCE + 50);
    const roadMat = new THREE.MeshPhongMaterial({ color: '#374151' }); // Dark asphalt
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -(MAX_STEPS * STEP_DISTANCE) / 2 + 10);
    scene.add(road);

    // Road lines
    for (let i = 0; i < MAX_STEPS * STEP_DISTANCE + 50; i += 4) {
        const lineGeo = new THREE.PlaneGeometry(0.4, 2);
        const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.01, 20 - i);
        scene.add(line);
    }
}

function createFinishLine() {
    const finishGeo = new THREE.PlaneGeometry(12, 2);
    const finishMat = new THREE.MeshBasicMaterial({ color: '#facc15' }); // Yellow finish
    finishLine = new THREE.Mesh(finishGeo, finishMat);
    finishLine.rotation.x = -Math.PI / 2;
    finishLine.position.set(0, 0.02, -(MAX_STEPS * STEP_DISTANCE));
    scene.add(finishLine);

    // Finish Arch
    const archMat = new THREE.MeshPhongMaterial({ color: '#111827' });
    const colGeo = new THREE.CylinderGeometry(0.5, 0.5, 6);
    const leftCol = new THREE.Mesh(colGeo, archMat);
    leftCol.position.set(-6, 3, -(MAX_STEPS * STEP_DISTANCE));
    scene.add(leftCol);

    const rightCol = new THREE.Mesh(colGeo, archMat);
    rightCol.position.set(6, 3, -(MAX_STEPS * STEP_DISTANCE));
    scene.add(rightCol);

    const topGeo = new THREE.BoxGeometry(13, 1, 1);
    const topBar = new THREE.Mesh(topGeo, archMat);
    topBar.position.set(0, 6.5, -(MAX_STEPS * STEP_DISTANCE));
    scene.add(topBar);
}

function createCar(colorHex) {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(2, 0.8, 4);
    const bodyMat = new THREE.MeshPhongMaterial({ color: colorHex });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    group.add(body);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.4, 0.6, 2);
    const cabinMat = new THREE.MeshPhongMaterial({ color: '#9ca3af' }); // Windows
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.3, -0.2);
    group.add(cabin);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshPhongMaterial({ color: '#111827' });

    const wheelPositions = [
        [-1.1, 0.4, 1.2],
        [1.1, 0.4, 1.2],
        [-1.1, 0.4, -1.2],
        [1.1, 0.4, -1.2]
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(...pos);
        group.add(wheel);
    });

    return group;
}

function startGame() {
    uiOverlay.classList.remove('visible');
    
    playerSteps = 0;
    pcSteps = 0;
    
    playerCar.position.z = 0;
    pcCar.position.z = 0;
    
    updateProgressUI();
    
    isPlaying = true;
    uiInput.disabled = false;
    uiSubmit.disabled = false;
    uiInput.value = '';
    uiInput.focus();
    
    generateQuestion();

    // Clear old timer if any
    if (pcTimer) clearInterval(pcTimer);

    // PC advances every 3.5 seconds
    pcTimer = setInterval(() => {
        if (!isPlaying) return;
        pcSteps++;
        updateProgressUI();
        if (pcSteps >= MAX_STEPS) {
            endGame(false);
        }
    }, 3500);
}

function generateQuestion() {
    const types = ['+', '-', '*'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let a, b;
    if (type === '+') {
        // 2-digit + 1-digit
        a = Math.floor(Math.random() * 40) + 10; // 10 to 49
        b = Math.floor(Math.random() * 9) + 1;   // 1 to 9
        currentAnswer = a + b;
    } else if (type === '-') {
        // 2-digit - 1-digit
        a = Math.floor(Math.random() * 40) + 10; // 10 to 49
        b = Math.floor(Math.random() * 9) + 1;   // 1 to 9
        currentAnswer = a - b;
    } else if (type === '*') {
        // Multiplication by 1 or 2
        a = Math.floor(Math.random() * 9) + 1; // 1 to 9
        b = Math.floor(Math.random() * 2) + 1; // 1 or 2
        if (Math.random() > 0.5) {
            let temp = a;
            a = b;
            b = temp;
        }
        currentAnswer = a * b;
    }

    uiQuestion.innerText = `${a} ${type} ${b} = ?`;
}

function checkAnswer() {
    if (!isPlaying) return;

    const val = parseInt(uiInput.value, 10);
    if (isNaN(val)) return;

    if (val === currentAnswer) {
        // Correct
        playerSteps++;
        updateProgressUI();
        showNotification('Correct! 🏎️💨', '#34d399');
        uiInput.value = '';
        
        if (playerSteps >= MAX_STEPS) {
            endGame(true);
        } else {
            generateQuestion();
        }
    } else {
        // Wrong
        showNotification('Oops! ❌', '#ef4444');
        uiInput.value = '';
        // Penalty: maybe don't change question, let them try again
    }
    uiInput.focus();
}

function updateProgressUI() {
    uiPlayerProgress.style.width = `${(playerSteps / MAX_STEPS) * 100}%`;
    uiPcProgress.style.width = `${(pcSteps / MAX_STEPS) * 100}%`;
}

function endGame(playerWon) {
    isPlaying = false;
    clearInterval(pcTimer);
    uiInput.disabled = true;
    uiSubmit.disabled = true;

    if (playerWon) {
        score++;
        const scoreVal = document.getElementById('score-val');
        if (scoreVal) scoreVal.textContent = score;
        const hurray = document.getElementById('hurray');
        hurray.classList.add('show');
        setTimeout(() => {
            hurray.classList.remove('show');
            uiTitle.innerText = "You Won! 🏆";
            uiOverlay.classList.add('visible');
        }, 2000);
    } else {
        uiTitle.innerText = "PC Won! 🤖";
        uiOverlay.classList.add('visible');
    }
}

function showNotification(msg, color) {
    const notify = document.getElementById('notify');
    const notifyText = document.getElementById('notify-text');
    notifyText.innerText = msg;
    if (color) notifyText.style.color = color;
    
    notify.classList.remove('show');
    // trigger reflow
    void notify.offsetWidth;
    notify.classList.add('show');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(time) {
    requestAnimationFrame(animate);
    
    const dt = (time - lastTime) / 1000 || 0;
    lastTime = time;

    // Smoothly animate cars to their target Z
    const targetPlayerZ = -(playerSteps * STEP_DISTANCE);
    const targetPcZ = -(pcSteps * STEP_DISTANCE);

    if (playerCar) {
        playerCar.position.z += (targetPlayerZ - playerCar.position.z) * 0.1;
    }
    if (pcCar) {
        pcCar.position.z += (targetPcZ - pcCar.position.z) * 0.1;
    }

    // Camera follows player
    if (camera && playerCar) {
        const targetCamZ = playerCar.position.z + 15;
        camera.position.z += (targetCamZ - camera.position.z) * 0.1;
        // Look ahead
        camera.lookAt(0, 0, camera.position.z - 20);
    }

    renderer.render(scene, camera);
}
