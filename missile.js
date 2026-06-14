import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let ship;
let launcherTube;
let targetCoord = { x: 0, y: 0 };
let score = 0;
let misfires = 0;
let isAnimating = false;

const gridSize = 20; // 0 to 20
const cellWorldSize = 1;

init();
animate();

function init() {
    // 1. Scene setup
    const canvas = document.querySelector('#c');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a1a2e');
    scene.fog = new THREE.FogExp2('#1a1a2e', 0.02);

    // 2. Camera (Orthographic for 2D look)
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 25;
    camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 1000);
    // Look at the first quadrant
    camera.position.set(10, 10, 35);

    // 3. Controls (Pan and Zoom only for 2D)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableRotate = false;
    controls.target.set(10, 10, 0);
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 30);
    scene.add(dirLight);

    // 5. Grid and Axes
    // We want the grid on the XY plane. GridHelper defaults to XZ plane.
    const gridHelper = new THREE.GridHelper(gridSize, gridSize, 0xffffff, 0xffffff);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.set(10, 10, 0);
    scene.add(gridHelper);
    
    // Axes helper: X is red, Y is green, Z is blue
    const axesHelper = new THREE.AxesHelper(20);
    scene.add(axesHelper);

    // Add labels for axes
    for (let i = 1; i <= 20; i++) {
        addAxisLabel(i.toString(), i, -0.6, '#f87171', 50, 1);
        addAxisLabel(i.toString(), -0.6, i, '#34d399', 50, 1);
    }
    addAxisLabel('X', 21, 0, '#f87171', 80, 1.5);
    addAxisLabel('Y', 0, 21, '#34d399', 80, 1.5);

    // 6. Spawn the first ship and launcher
    spawnShip();
    createLauncher();

    // 7. Event Listeners
    window.addEventListener('resize', onWindowResize);
    document.getElementById('btn-fire').addEventListener('click', fireMissile);
}

function addAxisLabel(text, x, y, colorStr, fontSize = 60, scaleSize = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colorStr;
    ctx.font = `bold ${fontSize}px JetBrains Mono, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, 0);
    sprite.scale.set(scaleSize, scaleSize, 1);
    scene.add(sprite);
}

function spawnShip() {
    if (ship) {
        scene.remove(ship);
    }
    
    // Random integer between 0 and 20 (inclusive)
    targetCoord.x = Math.floor(Math.random() * 21);
    targetCoord.y = Math.floor(Math.random() * 21);

    // Create ship geometry
    const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const material = new THREE.MeshPhongMaterial({ color: '#facc15', emissive: '#854d0e' });
    ship = new THREE.Mesh(geometry, material);
    
    ship.position.set(targetCoord.x, targetCoord.y, 0.4);
    scene.add(ship);
}

function createLauncher() {
    const launcherGroup = new THREE.Group();
    launcherGroup.position.set(-5, -5, 0);
    
    // Base
    const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.4, 16);
    baseGeo.rotateX(Math.PI / 2);
    const baseMat = new THREE.MeshPhongMaterial({ color: '#374151' });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.z = 0.2;
    launcherGroup.add(base);

    // Mount
    const mountGeo = new THREE.BoxGeometry(0.8, 0.8, 1.0);
    const mountMat = new THREE.MeshPhongMaterial({ color: '#4b5563' });
    const mount = new THREE.Mesh(mountGeo, mountMat);
    mount.position.z = 0.7;
    launcherGroup.add(mount);
    
    // Rotatable Tube
    launcherTube = new THREE.Group();
    launcherTube.position.set(-5, -5, 1.2);

    const tubeGeo = new THREE.CylinderGeometry(0.5, 0.5, 2.5, 16);
    tubeGeo.rotateX(Math.PI / 2);
    const tubeMat = new THREE.MeshPhongMaterial({ color: '#1f2937' });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    launcherTube.add(tube);
    
    const tipGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.2, 16);
    tipGeo.rotateX(Math.PI / 2);
    const tipMat = new THREE.MeshPhongMaterial({ color: '#ef4444' });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.z = 1.15;
    launcherTube.add(tip);

    launcherTube.lookAt(new THREE.Vector3(10, 10, 0));
    
    scene.add(launcherGroup);
    scene.add(launcherTube);
}

function fireMissile() {
    if (isAnimating) return;
    
    const inputX = parseInt(document.getElementById('input-x').value, 10);
    const inputY = parseInt(document.getElementById('input-y').value, 10);

    if (isNaN(inputX) || isNaN(inputY)) {
        showNotification('Enter valid coordinates!', '#f59e0b');
        return;
    }

    if (inputX < 0 || inputX > 20 || inputY < 0 || inputY > 20) {
        showNotification('Coordinates must be between 0 and 20!', '#f59e0b');
        return;
    }

    isAnimating = true;

    // Create missile group
    const missile = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.0, 16);
    bodyGeo.rotateX(Math.PI / 2); 
    const bodyMat = new THREE.MeshPhongMaterial({ color: '#e5e7eb' });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    missile.add(body);

    // Nose
    const noseGeo = new THREE.ConeGeometry(0.15, 0.4, 16);
    noseGeo.rotateX(Math.PI / 2); 
    const noseMat = new THREE.MeshPhongMaterial({ color: '#ef4444' });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.z = 0.7; 
    missile.add(nose);

    // Fins
    const finGeo = new THREE.BoxGeometry(0.04, 0.5, 0.3);
    const finMat = new THREE.MeshPhongMaterial({ color: '#ef4444' });

    const fin1 = new THREE.Mesh(finGeo, finMat);
    fin1.position.set(0, 0.15, -0.35); 
    missile.add(fin1);

    const fin2 = new THREE.Mesh(finGeo, finMat);
    fin2.position.set(0, -0.15, -0.35);
    missile.add(fin2);

    const fin3 = new THREE.Mesh(finGeo, finMat);
    fin3.rotation.z = Math.PI / 2;
    fin3.position.set(-0.15, 0, -0.35);
    missile.add(fin3);

    const fin4 = new THREE.Mesh(finGeo, finMat);
    fin4.rotation.z = Math.PI / 2;
    fin4.position.set(0.15, 0, -0.35);
    missile.add(fin4);
    
    // Engine
    const engineGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.1, 16);
    engineGeo.rotateX(Math.PI / 2);
    const engineMat = new THREE.MeshBasicMaterial({ color: '#f97316' });
    const engine = new THREE.Mesh(engineGeo, engineMat);
    engine.position.z = -0.55;
    missile.add(engine);

    missile.scale.set(0.8, 0.8, 0.8);
    
    const endPos = new THREE.Vector3(inputX, inputY, 0.4);
    
    if (launcherTube) {
        launcherTube.lookAt(endPos);
    }
    
    // Start from the launcher tube's position
    const startPos = launcherTube ? launcherTube.position.clone() : new THREE.Vector3(-5, -5, 1.2);
    
    missile.position.copy(startPos);
    // Point missile at target
    missile.lookAt(endPos);
    scene.add(missile);

    const hitSuccess = (inputX === targetCoord.x && inputY === targetCoord.y);
    
    // Animation variables
    const duration = 3000; // ms (slower missile)
    const startTime = performance.now();

    function animateMissile(time) {
        const elapsed = time - startTime;
        const t = Math.min(elapsed / duration, 1);
        
        // Ease out quad
        const easeT = t * (2 - t);
        
        missile.position.lerpVectors(startPos, endPos, easeT);
        
        // Exhaust particles
        const tailOffset = new THREE.Vector3(0, 0, -0.45).applyQuaternion(missile.quaternion);
        const exhaustPos = missile.position.clone().add(tailOffset);
        for(let i=0; i<3; i++) {
            createExhaustParticle(exhaustPos);
        }

        if (t < 1) {
            requestAnimationFrame(animateMissile);
        } else {
            // Reached target
            scene.remove(missile);
            
            if (hitSuccess) {
                showNotification('DIRECT HIT! 🎯', '#34d399');
                score++;
                document.getElementById('s-score').innerText = score;
                createExplosion(endPos, '#ffffff', 50); // Flash
                createExplosion(endPos, '#facc15', 150); // Core
                createExplosion(endPos, '#ef4444', 100); // Fire
                playExplosionSound();
                setTimeout(() => {
                    spawnShip();
                    isAnimating = false;
                }, 1000);
            } else {
                showNotification('MISFIRE! ❌', '#ef4444');
                misfires++;
                document.getElementById('s-misfires').innerText = misfires;
                createExplosion(endPos, '#e5e7eb', 80); // White smoke
                createExplosion(endPos, '#6b7280', 100); // Grey explosion for miss
                playExplosionSound();
                isAnimating = false;
            }
        }
    }
    
    requestAnimationFrame(animateMissile);
}

function createExplosion(pos, colorStr, pCount = 150) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);
    const velocities = [];

    for (let i = 0; i < pCount; i++) {
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 6
        );
        velocities.push(velocity);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: colorStr, size: 0.4 });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    const startTime = performance.now();
    function animateParticles(time) {
        const elapsed = time - startTime;
        if (elapsed > 1500) {
            scene.remove(particles);
            geometry.dispose();
            material.dispose();
            return;
        }

        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < pCount; i++) {
            positions[i * 3] += velocities[i].x * 0.1;
            positions[i * 3 + 1] += velocities[i].y * 0.1;
            positions[i * 3 + 2] += velocities[i].z * 0.1;
            velocities[i].multiplyScalar(0.96); // drag effect
        }
        particles.geometry.attributes.position.needsUpdate = true;
        
        requestAnimationFrame(animateParticles);
    }
    requestAnimationFrame(animateParticles);
}

function createExhaustParticle(pos) {
    const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const color = Math.random() > 0.5 ? '#f97316' : (Math.random() > 0.5 ? '#ef4444' : '#facc15');
    const mat = new THREE.MeshBasicMaterial({ color: color });
    const particle = new THREE.Mesh(geo, mat);
    
    // randomize slightly behind missile
    particle.position.copy(pos);
    particle.position.x += (Math.random() - 0.5) * 0.6;
    particle.position.y += (Math.random() - 0.5) * 0.6;
    scene.add(particle);
    
    const startTime = performance.now();
    function animateParticle(time) {
        const elapsed = time - startTime;
        if (elapsed > 500) {
            scene.remove(particle);
            geo.dispose();
            mat.dispose();
            return;
        }
        const scale = 1 - (elapsed / 500);
        particle.scale.set(scale, scale, scale);
        // exhaust drifts away opposite to movement (downwards in 2D)
        particle.position.y -= 0.05;
        particle.position.x += (Math.random() - 0.5) * 0.05;
        
        requestAnimationFrame(animateParticle);
    }
    requestAnimationFrame(animateParticle);
}

function showNotification(msg, color) {
    const notify = document.getElementById('notify');
    const notifyText = document.getElementById('notify-text');
    notifyText.innerText = msg;
    if (color) notifyText.style.color = color;
    notify.classList.add('show');
    
    setTimeout(() => {
        notify.classList.remove('show');
    }, 2000);
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 25;
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    if (ship && !isAnimating) {
        ship.rotation.x += 0.01;
        ship.rotation.y += 0.02;
    }
    
    controls.update();
    renderer.render(scene, camera);
}

function playExplosionSound() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    // Need to resume or create context based on user interaction
    const ctx = new AudioContext();
    
    // Create white noise
    const bufferSize = ctx.sampleRate * 2.0; // 2 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1; 
    }
    
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    
    // Lowpass filter for a deep boom
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 1.5);
    
    // Gain for explosive attack and decay
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(3.0, ctx.currentTime); // LOUD
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
    
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    noiseSource.start();
}
