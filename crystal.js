const grid = document.getElementById('grid');
const polyLeft = document.getElementById('poly-left');
const polyRight = document.getElementById('poly-right');
const scoreEl = document.getElementById('score');

let targetPoints = [];
let placedPoints = [];
let score = 0;

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

function playDing() {
    playTone(800, 'sine', 0.1, 0.1);
}

function playSuccess() {
    playTone(400, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(600, 'sine', 0.1, 0.1), 100);
    setTimeout(() => playTone(800, 'sine', 0.3, 0.1), 200);
}

function playError() {
    playTone(150, 'sawtooth', 0.3, 0.1);
}

function generateRound() {
    // Clear old points
    document.querySelectorAll('.point').forEach(p => p.remove());
    document.querySelectorAll('.point-mirror').forEach(p => p.remove());
    polyRight.setAttribute('points', '');
    
    targetPoints = [];
    placedPoints = [];
    
    // Grid is 10x10. Unit=50px. Y-axis is at x=5 (250px).
    // Left side is x: 1 to 4. y: 1 to 9.
    
    let pts = [];
    for(let i=0; i<3; i++) {
        let x = Math.floor(Math.random() * 4) + 1;
        let y = Math.floor(Math.random() * 9) + 1;
        pts.push({x, y});
        
        // Target mirrored point
        // If x=4, mirror is 6. mirrorX = 10 - x
        let mx = 10 - x;
        targetPoints.push({x: mx, y: y});
    }
    
    // Draw left points and polygon
    let pointsStr = '';
    pts.forEach(p => {
        let div = document.createElement('div');
        div.className = 'point';
        div.style.left = `${p.x * 50}px`;
        div.style.top = `${p.y * 50}px`;
        grid.appendChild(div);
        
        pointsStr += `${p.x * 50},${p.y * 50} `;
    });
    polyLeft.setAttribute('points', pointsStr.trim());
}

grid.addEventListener('click', (e) => {
    // Check if click was on right side
    const rect = grid.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    
    // Snap to grid
    let gx = Math.round(cx / 50);
    let gy = Math.round(cy / 50);
    
    // Prevent clicking on left side or out of bounds
    if (gx <= 5 || gx > 9 || gy < 1 || gy > 9) return;
    
    // Check if this point is in targetPoints and not yet placed
    let targetIndex = targetPoints.findIndex(p => p.x === gx && p.y === gy);
    let alreadyPlaced = placedPoints.find(p => p.x === gx && p.y === gy);
    
    if (targetIndex !== -1 && !alreadyPlaced) {
        playDing();
        placedPoints.push({x: gx, y: gy});
        
        let div = document.createElement('div');
        div.className = 'point-mirror';
        div.style.left = `${gx * 50}px`;
        div.style.top = `${gy * 50}px`;
        grid.appendChild(div);
        
        // Draw partial or full polygon
        // But polygon requires specific order to match original
        // Let's just draw the full polygon when all 3 are placed
        
        if (placedPoints.length === 3) {
            // Draw right polygon matching left's order
            let rPtsStr = '';
            targetPoints.forEach(p => {
                rPtsStr += `${p.x * 50},${p.y * 50} `;
            });
            polyRight.setAttribute('points', rPtsStr.trim());
            
            playSuccess();
            score += 10;
            scoreEl.innerText = score;
            
            setTimeout(generateRound, 2000);
        }
    } else if (targetIndex === -1) {
        playError();
        score = Math.max(0, score - 5);
        scoreEl.innerText = score;
    }
});

generateRound();
