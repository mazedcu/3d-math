const elTotalApples = document.getElementById('total-apples');
const elRatioText = document.getElementById('ratio-text');
const inputBoy = document.getElementById('input-boy');
const inputGirl = document.getElementById('input-girl');
const btnGive = document.getElementById('btn-give');
const btnNext = document.getElementById('btn-next');
const svgBoy = document.getElementById('svg-boy');
const svgGirl = document.getElementById('svg-girl');
const centerBasket = document.getElementById('center-basket');
const basketBoy = document.getElementById('basket-boy');
const basketGirl = document.getElementById('basket-girl');
const errorMsg = document.getElementById('error-msg');

let currentTotal = 0;
let targetBoy = 0;
let targetGirl = 0;
let apples = [];

let currentPlayer = 1;
let currentTry = 1;
let score1 = 0;
let score2 = 0;

const announceOverlay = document.getElementById('announcement-overlay');
const btnStart = document.getElementById('btn-start');

btnStart.addEventListener('click', () => {
    announceOverlay.classList.remove('visible');
    if (document.getElementById('announce-title').innerText === "GAME OVER") {
        currentPlayer = 1;
        currentTry = 1;
        score1 = 0;
        score2 = 0;
        updateScores();
    }
    initRound();
});

function updateScores() {
    document.getElementById('score-p1').innerText = score1;
    document.getElementById('score-p2').innerText = score2;
}

function showAnnouncement(title, subtitle, btnText) {
    document.getElementById('announce-title').innerText = title;
    document.getElementById('announce-title').style.color = currentPlayer === 1 ? '#3b82f6' : '#f43f5e';
    document.getElementById('announce-subtitle').innerText = subtitle;
    btnStart.innerText = btnText;
    announceOverlay.classList.add('visible');
}

function endGame() {
    let msg = score1 > score2 ? "Player 1 Wins!" : (score2 > score1 ? "Player 2 Wins!" : "It's a Tie!");
    document.getElementById('announce-emoji').innerText = '🏆';
    showAnnouncement("GAME OVER", `P1: ${score1} | P2: ${score2}\n\n${msg}`, "PLAY AGAIN");
}

function initRound() {
    // Generate ratio
    const ratios = [
        [1, 1], [1, 2], [1, 3], [1, 4], [2, 1], [3, 1], [4, 1],
        [2, 3], [3, 2], [3, 4], [4, 3], [1, 5], [5, 1]
    ];
    const r = ratios[Math.floor(Math.random() * ratios.length)];
    const partBoy = r[0];
    const partGirl = r[1];
    
    // Multiplier
    const maxMultiplier = Math.floor(40 / (partBoy + partGirl)); 
    const multiplier = Math.floor(Math.random() * (maxMultiplier - 1)) + 2; // at least 2
    
    currentTotal = (partBoy + partGirl) * multiplier;
    targetBoy = partBoy * multiplier;
    targetGirl = partGirl * multiplier;
    
    elTotalApples.innerText = currentTotal;
    elRatioText.innerText = `${partBoy} : ${partGirl}`;
    
    // Update HUD
    document.getElementById('turn-indicator').innerText = `P${currentPlayer}'S TURN`;
    document.getElementById('turn-indicator').style.color = currentPlayer === 1 ? '#3b82f6' : '#f43f5e';
    document.getElementById('try-count').innerText = currentTry;
    
    // Reset UI
    inputBoy.value = '';
    inputGirl.value = '';
    inputBoy.disabled = false;
    inputGirl.disabled = false;
    btnGive.style.display = 'block';
    btnNext.style.display = 'none'; // Re-using btnNext? Not really needed anymore.
    svgBoy.classList.remove('happy', 'crying');
    svgGirl.classList.remove('happy', 'crying');
    errorMsg.style.opacity = 0;
    
    createApples();
}

function createApples() {
    // Clear old apples
    apples.forEach(a => {
        if(a.el.parentNode) a.el.parentNode.removeChild(a.el);
    });
    apples = [];
    
    // We append them to the body for absolute positioning
    const centerRect = centerBasket.getBoundingClientRect();
    
    for (let i = 0; i < currentTotal; i++) {
        const apple = document.createElement('div');
        apple.className = 'apple';
        
        // Random position within the big basket
        const offsetX = Math.random() * 140 + 15; // 15 to 155
        const offsetY = Math.random() * 30 + 10;
        
        const startX = centerRect.left + offsetX;
        const startY = centerRect.top + offsetY;
        
        apple.style.left = startX + 'px';
        apple.style.top = startY + 'px';
        
        document.body.appendChild(apple);
        apples.push({
            el: apple,
            startX,
            startY
        });
    }
}

function giveApples() {
    const valBoy = parseInt(inputBoy.value) || 0;
    const valGirl = parseInt(inputGirl.value) || 0;
    
    // Disable inputs and start
    errorMsg.style.opacity = 0;
    inputBoy.disabled = true;
    inputGirl.disabled = true;
    btnGive.style.display = 'none';
    
    if (valBoy + valGirl !== currentTotal) {
        triggerCrying();
        showError(`Wrong total! You must distribute exactly ${currentTotal} apples.`);
        
        // Auto advance to next try
        setTimeout(() => {
            nextTry();
        }, 3000);
        return;
    }
    
    animateApples(valBoy, valGirl);
    
    // Wait for animation to finish before showing emotion
    setTimeout(() => {
        if (valBoy === targetBoy && valGirl === targetGirl) {
            // Success
            triggerHappy();
            if (currentPlayer === 1) score1 += 10;
            else score2 += 10;
            updateScores();
        } else {
            // Fail
            triggerCrying();
            showError(`Incorrect ratio! Should be ${targetBoy} and ${targetGirl}.`);
        }
        
        // Auto advance to next try
        setTimeout(() => {
            nextTry();
        }, 3000);
    }, 1000);
}

function nextTry() {
    currentTry++;
    if (currentTry > 5) {
        if (currentPlayer === 1) {
            currentPlayer = 2;
            currentTry = 1;
            document.getElementById('announce-emoji').innerText = '🎮';
            showAnnouncement("PLAYER 2", "Get ready for your 5 tries!", "START P2");
        } else {
            endGame();
        }
    } else {
        initRound();
    }
}

function showError(msg) {
    errorMsg.innerText = msg;
    errorMsg.style.opacity = 1;
    setTimeout(() => { errorMsg.style.opacity = 0; }, 3000);
}

function triggerHappy() {
    svgBoy.classList.remove('crying');
    svgGirl.classList.remove('crying');
    svgBoy.classList.add('happy');
    svgGirl.classList.add('happy');
    
    // Spawn HURRAY effect
    const hurray = document.createElement('div');
    hurray.className = 'hurray show';
    hurray.innerHTML = '<div class="hurray-text">HURRAY!</div>';
    document.body.appendChild(hurray);
    setTimeout(() => {
        if (hurray.parentNode) hurray.parentNode.removeChild(hurray);
    }, 2000);
}

function triggerCrying() {
    svgBoy.classList.remove('happy');
    svgGirl.classList.remove('happy');
    svgBoy.classList.add('crying');
    svgGirl.classList.add('crying');
}

function animateApples(countBoy, countGirl) {
    const rectBoy = basketBoy.getBoundingClientRect();
    const rectGirl = basketGirl.getBoundingClientRect();
    
    let boyGiven = 0;
    
    apples.forEach((a, index) => {
        let targetRect;
        if (boyGiven < countBoy) {
            targetRect = rectBoy;
            boyGiven++;
        } else {
            targetRect = rectGirl;
        }
        
        // Random position within the target basket
        const offsetX = Math.random() * 60 + 15;
        const offsetY = Math.random() * 20 + 10;
        
        const finalX = targetRect.left + offsetX;
        const finalY = targetRect.top + offsetY;
        
        // Stagger animation slightly
        setTimeout(() => {
            a.el.style.left = finalX + 'px';
            a.el.style.top = finalY + 'px';
        }, Math.random() * 400);
    });
}

// Window resize handling for apples
window.addEventListener('resize', () => {
    // For simplicity, just snap apples to center if game is active
    if (btnGive.style.display !== 'none') {
        const centerRect = centerBasket.getBoundingClientRect();
        apples.forEach(a => {
            const offsetX = Math.random() * 140 + 15;
            const offsetY = Math.random() * 30 + 10;
            a.el.style.left = (centerRect.left + offsetX) + 'px';
            a.el.style.top = (centerRect.top + offsetY) + 'px';
        });
    }
});

btnGive.addEventListener('click', giveApples);
// btnNext.addEventListener('click', initRound); // Disabled since it auto advances
