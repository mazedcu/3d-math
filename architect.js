const grid = document.getElementById('grid');
const polyPath = document.getElementById('shape-polygon');
const targetNameEl = document.getElementById('target-name');
const scoreEl = document.getElementById('score');
const btnSubmit = document.getElementById('btn-submit');

let score = 0;
let points = [];
let draggingPoint = null;
let currentTarget = null;
let isChecking = false;

// The shapes we can ask the user to build
const SHAPE_TARGETS = [
    'Square',
    'Rectangle',
    'Rhombus',
    'Parallelogram',
    'Trapezium',
    'Right-Angled Triangle',
    'Isosceles Triangle'
];

// Audio Setup
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
    playTone(200, 'sawtooth', 0.4, 0.1);
    setTimeout(() => playTone(150, 'sawtooth', 0.4, 0.1), 200);
}

// Math Helpers
function distSq(p1, p2) {
    return (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
}

function dotProduct(p1, p2, p3) {
    // Vector p2->p1 and p2->p3
    const v1x = p1.x - p2.x;
    const v1y = p1.y - p2.y;
    const v2x = p3.x - p2.x;
    const v2y = p3.y - p2.y;
    return v1x * v2x + v1y * v2y;
}

function crossProduct(v1, v2) {
    return v1.x * v2.y - v1.y * v2.x;
}

function areParallel(p1, p2, p3, p4) {
    const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const v2 = { x: p4.x - p3.x, y: p4.y - p3.y };
    // Two segments are parallel if cross product is 0
    return crossProduct(v1, v2) === 0;
}

function orderPoints(pts) {
    // Sort points in clockwise order around their centroid
    let cx = 0, cy = 0;
    pts.forEach(p => { cx += p.x; cy += p.y; });
    cx /= pts.length;
    cy /= pts.length;
    
    return pts.slice().sort((a, b) => {
        let angleA = Math.atan2(a.y - cy, a.x - cx);
        let angleB = Math.atan2(b.y - cy, b.x - cx);
        return angleA - angleB;
    });
}

function getShapeProperties(pts) {
    const ordered = orderPoints(pts);
    let sides = [];
    let parallelPairs = 0;
    let rightAngles = 0;
    
    // Check sides and angles
    for (let i = 0; i < ordered.length; i++) {
        const p1 = ordered[i];
        const p2 = ordered[(i + 1) % ordered.length];
        const p3 = ordered[(i + 2) % ordered.length];
        
        sides.push(distSq(p1, p2));
        
        if (dotProduct(p1, p2, p3) === 0) {
            rightAngles++;
        }
    }
    
    // Check parallel (only for quadrilaterals)
    let isOpposite1Parallel = false;
    let isOpposite2Parallel = false;
    
    if (ordered.length === 4) {
        isOpposite1Parallel = areParallel(ordered[0], ordered[1], ordered[2], ordered[3]);
        isOpposite2Parallel = areParallel(ordered[1], ordered[2], ordered[3], ordered[0]);
        if (isOpposite1Parallel) parallelPairs++;
        if (isOpposite2Parallel) parallelPairs++;
    }
    
    // Helper to check if array has equal values
    const allEqual = arr => arr.every(v => v === arr[0]);
    
    return {
        ordered,
        sides,
        rightAngles,
        parallelPairs,
        isOpposite1Parallel,
        isOpposite2Parallel,
        allSidesEqual: allEqual(sides)
    };
}

function detectShape() {
    const props = getShapeProperties(points);
    
    if (points.length === 3) {
        const s = props.sides;
        const isRight = props.rightAngles > 0;
        const isIsosceles = s[0] === s[1] || s[1] === s[2] || s[2] === s[0];
        
        if (currentTarget === 'Right-Angled Triangle' && isRight) return true;
        if (currentTarget === 'Isosceles Triangle' && isIsosceles) return true;
        return false;
    }
    
    if (points.length === 4) {
        // Area check (must not be zero area / self-intersecting / degenerate)
        // Degenerate checks: any side length 0?
        if (props.sides.includes(0)) return false;
        
        const isParallelogram = props.parallelPairs === 2;
        const isRhombus = isParallelogram && props.allSidesEqual;
        const isRectangle = isParallelogram && props.rightAngles === 4;
        const isSquare = isRectangle && isRhombus;
        const isTrapezium = props.parallelPairs === 1; // Strict trapezium (only 1 pair parallel)
        
        if (currentTarget === 'Square' && isSquare) return true;
        if (currentTarget === 'Rectangle' && isRectangle && !isSquare) return true;
        if (currentTarget === 'Rhombus' && isRhombus && !isSquare) return true;
        if (currentTarget === 'Parallelogram' && isParallelogram && !isRectangle && !isRhombus) return true;
        if (currentTarget === 'Trapezium' && isTrapezium) return true;
        
        return false;
    }
    return false;
}

function drawPolygon() {
    // Only draw polygon if points > 2
    if (points.length >= 3) {
        const ordered = orderPoints(points);
        const ptsStr = ordered.map(p => `${p.x * 40},${p.y * 40}`).join(' ');
        polyPath.setAttribute('points', ptsStr);
    }
}

function setupPoints(count) {
    // Clear old
    document.querySelectorAll('.vertex').forEach(el => el.remove());
    points = [];
    
    // Spawn points in a small cluster near center
    for (let i = 0; i < count; i++) {
        let px = 4 + i;
        let py = 4 + (i%2);
        
        points.push({ x: px, y: py });
        
        let el = document.createElement('div');
        el.className = 'vertex';
        el.dataset.index = i;
        el.style.left = `${px * 40}px`;
        el.style.top = `${py * 40}px`;
        
        // Drag logic
        el.addEventListener('mousedown', startDrag);
        el.addEventListener('touchstart', startDrag, {passive: false});
        
        grid.appendChild(el);
    }
    
    drawPolygon();
}

function startDrag(e) {
    if (isChecking) return; // disable drag while showing success
    e.preventDefault();
    draggingPoint = e.target;
}

function onDrag(e) {
    if (!draggingPoint || isChecking) return;
    
    // Get client pos
    let clientX = e.clientX;
    let clientY = e.clientY;
    
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }
    
    const rect = grid.getBoundingClientRect();
    let cx = clientX - rect.left;
    let cy = clientY - rect.top;
    
    // Snap to grid (0 to 10)
    let gx = Math.round(cx / 40);
    let gy = Math.round(cy / 40);
    
    // Clamp to 1..9 to keep them strictly inside
    gx = Math.max(1, Math.min(9, gx));
    gy = Math.max(1, Math.min(9, gy));
    
    const idx = parseInt(draggingPoint.dataset.index);
    
    // Check if another point is already here, prevent overlap (except self)
    const overlap = points.findIndex((p, i) => i !== idx && p.x === gx && p.y === gy);
    if (overlap !== -1) return;
    
    points[idx].x = gx;
    points[idx].y = gy;
    
    draggingPoint.style.left = `${gx * 40}px`;
    draggingPoint.style.top = `${gy * 40}px`;
    
    drawPolygon();
}

function endDrag(e) {
    if (draggingPoint) {
        draggingPoint = null;
    }
}

btnSubmit.addEventListener('click', () => {
    if (isChecking) return;
    
    if (detectShape()) {
        // SUCCESS!
        isChecking = true;
        polyPath.classList.add('success');
        playSuccess();
        
        score += 20;
        scoreEl.innerText = score;
        
        setTimeout(() => {
            polyPath.classList.remove('success');
            startNextRound();
        }, 1500);
    } else {
        // FAIL
        playError();
        score = Math.max(0, score - 5);
        scoreEl.innerText = score;
        
        // Flash red
        polyPath.style.stroke = '#ef4444';
        setTimeout(() => {
            polyPath.style.stroke = '';
        }, 500);
    }
});

document.addEventListener('mousemove', onDrag);
document.addEventListener('touchmove', onDrag, {passive: false});
document.addEventListener('mouseup', endDrag);
document.addEventListener('touchend', endDrag);

function startNextRound() {
    isChecking = false;
    // Pick random target
    currentTarget = SHAPE_TARGETS[Math.floor(Math.random() * SHAPE_TARGETS.length)];
    targetNameEl.innerText = currentTarget;
    
    const pointCount = currentTarget.includes('Triangle') ? 3 : 4;
    setupPoints(pointCount);
}

// Init
startNextRound();
