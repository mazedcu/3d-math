import * as THREE from 'three';

let scene, camera, renderer;
let planeGroup;
let allPropellers = [];
let bullets = [];
let numbers = [];

let score = 0;
let health = 100;
let targetMultiple = 3;
let isPlaying = false;
let lastTime = 0;
let playerSprite = null;
let mousePos = new THREE.Vector2(0, 0);
let lastShotTime = 0;

// Inputs
let keys = { ' ': false };
let planeVelocityY = 0;
const boundaryY = 9; // Up/down limit
const spawnX = 25; // Enemy spawn X
const despawnX = -25; // Enemy despawn X

// UI
const uiScore = document.getElementById('s-score');
const uiHealthFill = document.getElementById('health-fill');
const uiTarget = document.getElementById('target-number');
const uiStartTarget = document.getElementById('start-target');
const uiOverlay = document.getElementById('start-overlay');
const uiBtnStart = document.getElementById('btn-start');
const uiTitle = document.getElementById('game-end-title');

init();
animate();

function init() {
    const canvas = document.querySelector('#c');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#3b82f6'); // Sky blue
    scene.fog = new THREE.Fog('#3b82f6', 10, 60);

    // Camera - side scrolling view
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 20); // Look at origin from +Z
    camera.lookAt(0, 0, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 20);
    scene.add(dirLight);

    // Environment
    createEnvironment();

    // Biplane (Player)
    createBiplane();

    // Events
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', (e) => {
        const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
        mousePos.y = ndcY * 11.5; // Project roughly to Z=0 plane
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.preventDefault(); // Prevent page scroll
            keys[' '] = true;
            if (isPlaying) fireBullet();
        }
    });
    window.addEventListener('keyup', (e) => {
        if (e.key === ' ') {
            keys[' '] = false;
        }
    });
    uiBtnStart.addEventListener('click', startGame);

    // Initial setup
    pickNewTarget();
}

function createEnvironment() {
    // Cloud-like ground
    const groundGeo = new THREE.PlaneGeometry(200, 200, 10, 10);
    const groundMat = new THREE.MeshPhongMaterial({ color: '#60a5fa', flatShading: true });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -12; // Lower to keep out of way
    scene.add(ground);
}

function createBiplaneModel(colorHex) {
    const group = new THREE.Group();
    const mainMat = new THREE.MeshPhongMaterial({ color: colorHex });
    const whiteMat = new THREE.MeshPhongMaterial({ color: '#f3f4f6' });
    const darkMat = new THREE.MeshPhongMaterial({ color: '#1f2937' });

    // Fuselage
    const fuselageGeo = new THREE.CylinderGeometry(0.5, 0.3, 3.5, 12);
    fuselageGeo.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeo, mainMat);
    group.add(fuselage);

    // Wings
    const wingGeo = new THREE.BoxGeometry(5, 0.1, 1);
    const topWing = new THREE.Mesh(wingGeo, whiteMat);
    topWing.position.set(0, 0.8, -0.5);
    group.add(topWing);

    const bottomWing = new THREE.Mesh(wingGeo, whiteMat);
    bottomWing.position.set(0, -0.2, -0.5);
    group.add(bottomWing);

    // Struts
    const strutGeo = new THREE.CylinderGeometry(0.05, 0.05, 1);
    for(let x of [-2, 2]) {
        const strut = new THREE.Mesh(strutGeo, darkMat);
        strut.position.set(x, 0.3, -0.5);
        group.add(strut);
    }

    // Tail
    const tailHGeo = new THREE.BoxGeometry(1.5, 0.1, 0.8);
    const tailH = new THREE.Mesh(tailHGeo, whiteMat);
    tailH.position.set(0, 0, 1.5);
    group.add(tailH);

    const tailVGeo = new THREE.BoxGeometry(0.1, 1.0, 0.8);
    const tailV = new THREE.Mesh(tailVGeo, mainMat);
    tailV.position.set(0, 0.5, 1.5);
    group.add(tailV);

    // Propeller
    const propGroup = new THREE.Group();
    const bladeGeo = new THREE.BoxGeometry(2, 0.1, 0.1);
    const blade = new THREE.Mesh(bladeGeo, darkMat);
    propGroup.add(blade);
    const blade2 = new THREE.Mesh(bladeGeo, darkMat);
    blade2.rotation.z = Math.PI / 2;
    propGroup.add(blade2);
    
    propGroup.position.z = -1.8; // Propeller is at local -Z
    group.add(propGroup);

    allPropellers.push(propGroup);

    return group;
}

function createBiplane() {
    planeGroup = createBiplaneModel('#3b82f6'); // Player is blue
    // Position player on the left side, facing right (+X)
    planeGroup.position.set(-15, 0, 0); 
    // Rotate so local -Z points to +X
    planeGroup.rotation.y = -Math.PI / 2;
    
    // Create player sprite
    const mat = new THREE.SpriteMaterial({ map: null, transparent: true });
    playerSprite = new THREE.Sprite(mat);
    playerSprite.position.set(0, 3.0, 0);
    playerSprite.scale.set(4, 4, 1);
    planeGroup.add(playerSprite);

    scene.add(planeGroup);
}

function updatePlayerSprite() {
    if (!playerSprite) return;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#60a5fa'; // Light blue text for player
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 150px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(targetMultiple.toString(), 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    playerSprite.material.map = tex;
    playerSprite.material.needsUpdate = true;
}

function pickNewTarget() {
    targetMultiple = Math.floor(Math.random() * 8) + 2; // 2 to 9
    uiStartTarget.innerText = targetMultiple;
    uiTarget.innerText = targetMultiple;
    updatePlayerSprite();
}

function startGame() {
    uiOverlay.classList.remove('visible');
    
    score = 0;
    health = 100;
    uiScore.innerText = score;
    updateHealthUI();
    
    // Clear numbers and bullets
    numbers.forEach(n => scene.remove(n.mesh));
    numbers = [];
    bullets.forEach(b => scene.remove(b.mesh));
    bullets = [];
    
    planeGroup.position.y = 0;
    
    pickNewTarget();
    
    isPlaying = true;
    lastTime = performance.now();
}

function updateHealthUI() {
    uiHealthFill.style.width = Math.max(0, health) + '%';
    if (health <= 0) {
        endGame();
    }
}

function endGame() {
    isPlaying = false;
    uiTitle.innerText = "Game Over! Crash!";
    uiOverlay.classList.add('visible');
}

function fireBullet() {
    const now = performance.now();
    if (now - lastShotTime < 300) return; // 300ms cooldown (about 3 shots per second)
    lastShotTime = now;

    const geo = new THREE.CylinderGeometry(0.05, 0.05, 0.5);
    // Cylinder is along Y. We want it along X.
    geo.rotateZ(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: '#facc15' }); // Yellow tracer
    const mesh = new THREE.Mesh(geo, mat);
    
    // Spawn at front of plane (which is +X in world space)
    mesh.position.copy(planeGroup.position);
    mesh.position.x += 2.0;
    
    scene.add(mesh);
    bullets.push({ mesh, active: true });
}

function spawnNumber() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    const isMultiple = Math.random() > 0.5;
    let numVal;
    if (isMultiple) {
        numVal = targetMultiple * (Math.floor(Math.random() * 10) + 1);
    } else {
        do {
            numVal = Math.floor(Math.random() * 50) + 1;
        } while (numVal % targetMultiple === 0);
    }

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 150px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(numVal.toString(), 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(0, 3.0, 0); // Hover above the enemy plane
    sprite.scale.set(4, 4, 1);
    
    // Create enemy plane
    const enemyColor = isMultiple ? '#10b981' : '#f59e0b'; // Green or Orange
    const enemyPlane = createBiplaneModel(enemyColor);
    
    // Position on right, random Y
    enemyPlane.position.set(spawnX, (Math.random() - 0.5) * boundaryY * 2, 0);
    // Face left (-X). So local -Z points to -X.
    enemyPlane.rotation.y = Math.PI / 2;
    
    enemyPlane.add(sprite);
    scene.add(enemyPlane);
    
    numbers.push({
        mesh: enemyPlane,
        val: numVal,
        isMultiple: (numVal % targetMultiple === 0),
        active: true,
        isDead: false,
        fallSpeedY: 0,
        fallSpeedX: 0
    });
}

function createExplosion(pos, colorHex) {
    const pCount = 20;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);
    const velocities = [];

    for (let i = 0; i < pCount; i++) {
        positions[i*3] = pos.x;
        positions[i*3+1] = pos.y;
        positions[i*3+2] = pos.z;
        velocities.push(new THREE.Vector3((Math.random()-0.5)*10, (Math.random()-0.5)*10, (Math.random()-0.5)*10));
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: colorHex, size: 0.5 });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    const startT = performance.now();
    function animExplosion(t) {
        const dt = t - startT;
        if (dt > 500) {
            scene.remove(points);
            geo.dispose();
            mat.dispose();
            return;
        }
        const posArr = points.geometry.attributes.position.array;
        for (let i = 0; i < pCount; i++) {
            posArr[i*3] += velocities[i].x * 0.02;
            posArr[i*3+1] += velocities[i].y * 0.02;
            posArr[i*3+2] += velocities[i].z * 0.02;
        }
        points.geometry.attributes.position.needsUpdate = true;
        requestAnimationFrame(animExplosion);
    }
    requestAnimationFrame(animExplosion);
}

function showNotification(msg, color) {
    const notify = document.getElementById('notify');
    const notifyText = document.getElementById('notify-text');
    notifyText.innerText = msg;
    if (color) notifyText.style.color = color;
    
    notify.classList.remove('show');
    void notify.offsetWidth;
    notify.classList.add('show');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

let spawnTimer = 0;

function animate(time) {
    requestAnimationFrame(animate);
    
    const dt = (time - lastTime) / 1000 || 0;
    lastTime = time;

    // Spin propellers
    allPropellers.forEach(p => {
        if (p.parent) p.rotation.z += 20 * dt;
    });

    if (!isPlaying) {
        renderer.render(scene, camera);
        return;
    }

    // Input (Mouse follow)
    const targetY = Math.max(-boundaryY, Math.min(boundaryY, mousePos.y));
    const dy = targetY - planeGroup.position.y;
    planeVelocityY = dy * 5; // Spring force for smooth movement
    
    planeGroup.position.y += planeVelocityY * dt;
    
    // Clamp to bounds
    if (planeGroup.position.y > boundaryY) planeGroup.position.y = boundaryY;
    if (planeGroup.position.y < -boundaryY) planeGroup.position.y = -boundaryY;

    // Bank angle based on velocity (Pitching the nose up/down)
    // Rotating around world Z pitches the nose up and down!
    planeGroup.rotation.z = planeVelocityY * 0.05;
    
    // Spawn numbers
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnNumber();
        spawnTimer = 1.0 + Math.random() * 1.0; // Every 1-2 seconds
    }

    // Update bullets (moving +X)
    bullets.forEach(b => {
        if (!b.active) return;
        b.mesh.position.x += 40 * dt;
        if (b.mesh.position.x > spawnX + 5) {
            b.active = false;
            scene.remove(b.mesh);
        }
    });

    // Update enemies (moving -X)
    numbers.forEach(n => {
        if (!n.active) return;
        
        if (n.isDead) {
            n.fallSpeedY -= 40 * dt; // Gravity
            n.mesh.position.x += n.fallSpeedX * dt;
            n.mesh.position.y += n.fallSpeedY * dt;
            n.mesh.rotation.x += 5 * dt; // Spin wildly
            n.mesh.rotation.y += 5 * dt; 
            
            if (n.mesh.position.y < -20) {
                n.active = false;
                scene.remove(n.mesh);
            }
            return; // Skip other logic
        }

        n.mesh.position.x -= 15 * dt; // Move towards left

        // Check collision with bullets
        bullets.forEach(b => {
            if (!b.active || !n.active || n.isDead) return;
            if (b.mesh.position.distanceTo(n.mesh.position) < 1.5) { // Reduced hitbox
                // Hit!
                b.active = false;
                scene.remove(b.mesh);
                
                n.isDead = true;
                n.fallSpeedY = 10;
                n.fallSpeedX = -5;
                // Hide the number text
                n.mesh.children.forEach(c => { if(c.type === 'Sprite') c.visible = false; });

                if (n.isMultiple) {
                    showNotification('Nice shot!', '#facc15');
                    score += 10;
                    uiScore.innerText = score;
                    createExplosion(n.mesh.position, '#facc15');
                } else {
                    showNotification('Wrong number!', '#ef4444');
                    health -= 15;
                    updateHealthUI();
                    createExplosion(n.mesh.position, '#ef4444');
                }
            }
        });

        // Check collision with player
        if (n.active && !n.isDead && Math.abs(n.mesh.position.x - planeGroup.position.x) < 3.0) {
            if (Math.abs(n.mesh.position.y - planeGroup.position.y) < 2.5) {
                // Crash! Make it fall
                n.isDead = true;
                n.fallSpeedY = 10;
                n.fallSpeedX = -5;
                n.mesh.children.forEach(c => { if(c.type === 'Sprite') c.visible = false; });
                
                showNotification('CRASH!', '#ef4444');
                health -= 25;
                updateHealthUI();
                createExplosion(planeGroup.position, '#ef4444');
                // Shake plane
                planeGroup.position.x -= 1;
                setTimeout(() => planeGroup.position.x += 1, 100);
            }
        }

        if (n.mesh.position.x < despawnX) {
            n.active = false;
            scene.remove(n.mesh);
        }
    });

    // Clean up arrays
    bullets = bullets.filter(b => b.active);
    numbers = numbers.filter(n => n.active);
    allPropellers = allPropellers.filter(p => p.parent !== null);

    renderer.render(scene, camera);
}
