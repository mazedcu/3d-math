import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

let scene, camera, renderer, raycaster, mouse;
let playerShip, enemyShip, water;
let cannons = [];
let currentCannonball = null;
let activeProjectiles = [];

let playerHealth = 100;
let enemyHealth = 100;

const uiPlayerHealth = document.getElementById('player-health-bar');
const uiEnemyHealth = document.getElementById('enemy-health-bar');
const notifyEl = document.getElementById('notify');
const notifyText = document.getElementById('notify-text');
const notifySubtext = document.getElementById('notify-subtext');

// Possible sizes for cannonball radius & cannon bore
const SIZES = [0.3, 0.6, 0.9, 1.2];
let targetSize = 0;
let lastTime = 0;
let enemyFireTimer = 0;
const ENEMY_FIRE_RATE = 4000; // fires every 4 seconds

let gameState = 'playing'; // 'playing', 'won', 'lost'

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

function playFireSound() {
    playTone(150, 'square', 0.2, 0.2);
    setTimeout(() => playTone(100, 'sawtooth', 0.3, 0.2), 50);
}

function playHitSound() {
    playTone(80, 'sawtooth', 0.4, 0.3);
}

function playError() {
    playTone(200, 'sawtooth', 0.3, 0.1);
}

init();

function init() {
    const canvas = document.querySelector('#c');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87ceeb, 20, 100);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 15, 25);
    camera.lookAt(0, 0, 0);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    scene.add(dirLight);

    createEnvironment();
    createShips();
    createCannons();
    spawnCannonball();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('click', onClick);

    requestAnimationFrame(animate);
}

function createEnvironment() {
    // Water
    const waterGeo = new THREE.PlaneGeometry(200, 200, 32, 32);
    const waterMat = new THREE.MeshStandardMaterial({ 
        color: 0x006994, 
        roughness: 0.1, 
        metalness: 0.8,
        flatShading: true
    });
    water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.receiveShadow = true;
    
    // Add some simple waves by displacing vertices
    const pos = water.geometry.attributes.position;
    for(let i = 0; i < pos.count; i++) {
        pos.setZ(i, Math.random() * 0.5);
    }
    water.geometry.computeVertexNormals();

    scene.add(water);
}

function createShips() {
    const shipGeo = new THREE.BoxGeometry(8, 4, 16);
    const shipMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
    
    // Player Ship
    playerShip = new THREE.Mesh(shipGeo, shipMat);
    playerShip.position.set(0, 1, 10);
    playerShip.castShadow = true;
    playerShip.receiveShadow = true;
    scene.add(playerShip);

    // Enemy Ship
    enemyShip = new THREE.Mesh(shipGeo, new THREE.MeshStandardMaterial({ color: 0x5a2b2b, roughness: 0.8 }));
    enemyShip.position.set(0, 1, -30);
    enemyShip.rotation.y = Math.PI; // Face player
    enemyShip.castShadow = true;
    enemyShip.receiveShadow = true;
    scene.add(enemyShip);

    // Masts
    const mastGeo = new THREE.CylinderGeometry(0.3, 0.3, 10);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
    const pMast = new THREE.Mesh(mastGeo, mastMat);
    pMast.position.set(0, 5, 0);
    playerShip.add(pMast);

    const eMast = new THREE.Mesh(mastGeo, mastMat);
    eMast.position.set(0, 5, 0);
    enemyShip.add(eMast);
}

function createCannons() {
    // We will place cannons on the deck of the player ship, pointing forward
    const startX = -2.5;
    const spacing = 1.6;

    let shuffledSizes = [...SIZES].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffledSizes.length; i++) {
        const size = shuffledSizes[i];
        
        const cannonGroup = new THREE.Group();
        cannonGroup.position.set(startX + i * spacing, 2.5, 6);

        // Cannon Body
        // To visually show the "bore size", we can make the cannon radius proportional to the bore size
        const outerRadius = size + 0.3;
        const bodyGeo = new THREE.CylinderGeometry(outerRadius, outerRadius + 0.1, 4, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.4 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.rotation.x = Math.PI / 2; // Point forward
        bodyMesh.castShadow = true;
        cannonGroup.add(bodyMesh);

        // The Bore (hole)
        const holeGeo = new THREE.CylinderGeometry(size, size, 4.02, 16);
        const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const holeMesh = new THREE.Mesh(holeGeo, holeMat);
        holeMesh.rotation.x = Math.PI / 2;
        cannonGroup.add(holeMesh);

        // Clickable hitbox (invisible)
        const hitGeo = new THREE.BoxGeometry(outerRadius*2.5, outerRadius*2.5, 5);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitBox = new THREE.Mesh(hitGeo, hitMat);
        hitBox.userData = { isCannon: true, boreSize: size, cannonGroup: cannonGroup };
        cannonGroup.add(hitBox);
        cannons.push(hitBox);

        scene.add(cannonGroup);
    }
}

function spawnCannonball() {
    if (gameState !== 'playing') return;
    if (currentCannonball) {
        scene.remove(currentCannonball);
    }

    targetSize = SIZES[Math.floor(Math.random() * SIZES.length)];

    const ballGeo = new THREE.SphereGeometry(targetSize, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.4 });
    currentCannonball = new THREE.Mesh(ballGeo, ballMat);
    
    // Position it hovering near the player
    currentCannonball.position.set(0, 6, 12);
    currentCannonball.userData.radius = targetSize;
    currentCannonball.castShadow = true;

    scene.add(currentCannonball);
}

function fireAtEnemy(cannonPos, size) {
    playFireSound();

    const ballGeo = new THREE.SphereGeometry(size, 16, 16);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const proj = new THREE.Mesh(ballGeo, ballMat);
    proj.position.copy(cannonPos);
    proj.position.z -= 2; // Start slightly in front of cannon
    scene.add(proj);

    // Target is enemy ship
    const targetPos = enemyShip.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 1, (Math.random() - 0.5) * 4));
    
    activeProjectiles.push({
        mesh: proj,
        start: proj.position.clone(),
        target: targetPos,
        progress: 0,
        speed: 0.02,
        isPlayerProjectile: true,
        damage: 20
    });
}

function fireAtPlayer() {
    playFireSound();
    
    // Enemy fires a random sized ball
    const size = SIZES[Math.floor(Math.random() * SIZES.length)];
    const ballGeo = new THREE.SphereGeometry(size, 16, 16);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const proj = new THREE.Mesh(ballGeo, ballMat);
    
    // Enemy ship cannon pos (approx)
    proj.position.copy(enemyShip.position).add(new THREE.Vector3(0, 1.5, 6));
    scene.add(proj);

    const targetPos = playerShip.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 1, 0));

    activeProjectiles.push({
        mesh: proj,
        start: proj.position.clone(),
        target: targetPos,
        progress: 0,
        speed: 0.015, // Enemy projectiles slightly slower to give time
        isPlayerProjectile: false,
        damage: 15
    });
}

function handleImpact(projectile) {
    playHitSound();
    scene.remove(projectile.mesh);

    if (projectile.isPlayerProjectile) {
        enemyHealth -= projectile.damage;
        uiEnemyHealth.style.width = Math.max(0, enemyHealth) + '%';
        createExplosion(projectile.target);
        if (enemyHealth <= 0) {
            endGame(true);
        }
    } else {
        playerHealth -= projectile.damage;
        uiPlayerHealth.style.width = Math.max(0, playerHealth) + '%';
        createExplosion(projectile.target);
        
        // Flash screen red
        document.body.classList.add('flash-red');
        setTimeout(() => document.body.classList.remove('flash-red'), 200);

        if (playerHealth <= 0) {
            endGame(false);
        }
    }
}

function createExplosion(pos) {
    const particleGeo = new THREE.SphereGeometry(0.5, 8, 8);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffa500 });
    
    for(let i=0; i<5; i++) {
        const particle = new THREE.Mesh(particleGeo, particleMat);
        particle.position.copy(pos);
        scene.add(particle);
        
        const velocity = new THREE.Vector3((Math.random()-0.5)*0.5, Math.random()*0.5, (Math.random()-0.5)*0.5);
        
        // Quick local animation loop for particles
        let frames = 0;
        const animateParticle = () => {
            if(frames > 30) {
                scene.remove(particle);
                return;
            }
            particle.position.add(velocity);
            particle.material.opacity = 1 - (frames/30);
            particle.material.transparent = true;
            particle.scale.multiplyScalar(0.9);
            frames++;
            requestAnimationFrame(animateParticle);
        };
        animateParticle();
    }
}

function onClick(event) {
    if (gameState !== 'playing') return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(cannons);

    if (intersects.length > 0) {
        const hit = intersects[0].object;
        const boreSize = hit.userData.boreSize;
        
        // Check if matched
        if (Math.abs(boreSize - targetSize) < 0.01) {
            // MATCH!
            fireAtEnemy(hit.userData.cannonGroup.position, targetSize);
            
            // Cannon recoil animation
            hit.userData.cannonGroup.position.z += 0.5;
            setTimeout(() => {
                hit.userData.cannonGroup.position.z -= 0.5;
            }, 100);

            spawnCannonball();
        } else {
            // WRONG MATCH
            playError();
            document.body.classList.add('flash-red');
            setTimeout(() => document.body.classList.remove('flash-red'), 200);
        }
    }
}

function endGame(playerWon) {
    gameState = 'ended';
    if (currentCannonball) scene.remove(currentCannonball);

    notifyEl.classList.add('show');
    if (playerWon) {
        notifyText.innerText = "VICTORY!";
        notifyText.style.color = "#10b981";
        notifySubtext.innerText = "You sank the enemy ship!";
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    } else {
        notifyText.innerText = "DEFEAT";
        notifyText.style.color = "#ef4444";
        notifySubtext.innerText = "Your ship was destroyed.";
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(time) {
    requestAnimationFrame(animate);

    const dt = time - lastTime;
    lastTime = time;

    // Bobbing ships
    if (playerShip) {
        playerShip.position.y = 1 + Math.sin(time * 0.002) * 0.2;
        playerShip.rotation.z = Math.sin(time * 0.001) * 0.05;
        playerShip.rotation.x = Math.cos(time * 0.0015) * 0.02;
    }
    if (enemyShip) {
        enemyShip.position.y = 1 + Math.cos(time * 0.002) * 0.2;
        enemyShip.rotation.z = Math.cos(time * 0.001) * 0.05;
    }

    // Floating cannonball
    if (currentCannonball && gameState === 'playing') {
        currentCannonball.position.y = 6 + Math.sin(time * 0.003) * 0.3;
        currentCannonball.rotation.y += 0.01;
        currentCannonball.rotation.x += 0.005;
    }

    // Update projectiles
    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        let p = activeProjectiles[i];
        p.progress += p.speed;
        
        if (p.progress >= 1) {
            handleImpact(p);
            activeProjectiles.splice(i, 1);
        } else {
            // Parabolic arc
            p.mesh.position.lerpVectors(p.start, p.target, p.progress);
            // Add arc height
            const height = Math.sin(p.progress * Math.PI) * 5;
            p.mesh.position.y += height;
        }
    }

    // Enemy AI firing
    if (gameState === 'playing') {
        enemyFireTimer += dt;
        if (enemyFireTimer > ENEMY_FIRE_RATE) {
            enemyFireTimer = 0;
            fireAtPlayer();
        }
    }

    renderer.render(scene, camera);
}
