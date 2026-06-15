// ============================================================
//  Recipe Ratio — given a recipe ratio and the amount of one
//  or two ingredients, work out the amounts of the others.
// ============================================================

const uiScore = document.getElementById('s-score');
const uiRound = document.getElementById('s-round');
const uiBest = document.getElementById('s-best');
const uiCard = document.getElementById('recipe-card');
const uiOverlay = document.getElementById('start-overlay');
const uiBtnStart = document.getElementById('btn-start');
const uiTitle = document.getElementById('game-end-title');
const uiDesc = document.getElementById('game-end-desc');

const MAX_ROUNDS = 8;
let score = 0;
let round = 0;
let best = parseInt(localStorage.getItem('recipe_best') || '0', 10);
let current = null;     // current recipe round data
let checked = false;

uiBest.innerText = best;

// Recipe themes (name + emoji)
const RECIPES = [
    { name: 'Pancake Mix', emoji: '🥞', unit: 'cups' },
    { name: 'Chocolate Cake', emoji: '🍰', unit: 'cups' },
    { name: 'Berry Smoothie', emoji: '🥤', unit: 'ml' },
    { name: 'Cookie Dough', emoji: '🍪', unit: 'cups' },
    { name: 'Fresh Bread', emoji: '🍞', unit: 'cups' },
    { name: 'Muffin Batter', emoji: '🧁', unit: 'cups' },
    { name: 'Lemonade', emoji: '🍋', unit: 'ml' },
    { name: 'Trail Mix', emoji: '🥜', unit: 'g' },
    { name: 'Pizza Dough', emoji: '🍕', unit: 'cups' },
    { name: 'Hot Cocoa', emoji: '☕', unit: 'cups' },
];

// Ingredient pool (name + emoji)
const INGREDIENTS = [
    { name: 'Flour', e: '🌾' },
    { name: 'Sugar', e: '🍬' },
    { name: 'Milk', e: '🥛' },
    { name: 'Butter', e: '🧈' },
    { name: 'Cocoa', e: '🍫' },
    { name: 'Honey', e: '🍯' },
    { name: 'Water', e: '💧' },
    { name: 'Berries', e: '🫐' },
    { name: 'Cream', e: '🍦' },
    { name: 'Oats', e: '🥣' },
    { name: 'Nuts', e: '🥜' },
    { name: 'Cheese', e: '🧀' },
];

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
const rint = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

function makeRound() {
    const theme = RECIPES[rint(0, RECIPES.length - 1)];
    const count = Math.random() < 0.45 ? 2 : 3;          // 2 or 3 ingredients
    const picked = shuffle(INGREDIENTS).slice(0, count);

    // Distinct small ratio parts so the ratio reads cleanly
    const partsPool = shuffle([1, 2, 3, 4, 5, 6]).slice(0, count);
    const k = rint(2, 9);                                 // scale multiplier

    const items = picked.map((ing, i) => ({
        name: ing.name,
        e: ing.e,
        part: partsPool[i],
        amount: partsPool[i] * k,   // always a whole number
        given: false,
    }));

    // Decide how many ingredients are "given" (1, or 2 when 3 ingredients)
    const numGiven = (count === 3 && Math.random() < 0.5) ? 2 : 1;
    const giveIdx = shuffle(items.map((_, i) => i)).slice(0, numGiven);
    giveIdx.forEach(i => { items[i].given = true; });

    return { theme, items, unit: theme.unit };
}

function render() {
    const { theme, items, unit } = current;
    const ratioParts = items.map(it => `
        <div class="ratio-chip">
            <div class="ing-emoji">${it.e}</div>
            <div class="ing-name">${it.name}</div>
            <div class="ing-part">${it.part}</div>
        </div>`).join('<div class="ratio-colon">:</div>');

    const givens = items.filter(it => it.given).map(it => `
        <div class="line given">
            <span>${it.e} ${it.name}:</span>
            <span class="big">${it.amount}</span>
            <span class="unit">${unit}</span>
        </div>`).join('');

    const asks = items.map((it, i) => it.given ? '' : `
        <div class="line">
            <span>${it.e} ${it.name} =</span>
            <input class="amount-input" type="number" inputmode="numeric" data-i="${i}" />
            <span class="unit">${unit}</span>
        </div>`).join('');

    uiCard.innerHTML = `
        <div class="recipe-head"><span class="emoji">${theme.emoji}</span>${theme.name}</div>
        <div class="recipe-sub">Mix the ingredients in this ratio:</div>
        <div class="ratio-row">${ratioParts}</div>

        <div class="section-label">You have</div>
        <div class="given-row">${givens}</div>

        <div class="section-label">How much of the rest?</div>
        <div class="ask-row">${asks}</div>

        <div class="feedback" id="feedback"></div>
        <button class="action-btn" id="action-btn">CHECK</button>
    `;

    document.getElementById('action-btn').addEventListener('click', onAction);

    const inputs = uiCard.querySelectorAll('.amount-input');
    inputs.forEach((inp, idx) => {
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (idx < inputs.length - 1) inputs[idx + 1].focus();
                else onAction();
            }
        });
    });
    if (inputs[0]) inputs[0].focus();
    checked = false;
}

function onAction() {
    if (!checked) checkAnswers();
    else nextRound();
}

function checkAnswers() {
    const inputs = uiCard.querySelectorAll('.amount-input');
    const fb = document.getElementById('feedback');
    const actionBtn = document.getElementById('action-btn');

    // First, make sure every box is filled in.
    for (const inp of inputs) {
        if (inp.value.trim() === '') {
            fb.className = 'feedback no';
            fb.innerText = 'Fill in every box!';
            inp.focus();
            return;
        }
    }

    let total = 0, correct = 0;
    inputs.forEach(inp => {
        const i = parseInt(inp.dataset.i, 10);
        const expected = current.items[i].amount;
        total++;
        if (parseFloat(inp.value) === expected) {
            correct++;
            inp.classList.add('correct');
            inp.classList.remove('wrong');
        } else {
            inp.classList.add('wrong');
            inp.classList.remove('correct');
            inp.value = expected;   // reveal the correct amount
        }
        inp.disabled = true;
    });

    const gained = Math.round((correct / total) * 10);
    score += gained;
    uiScore.innerText = score;
    if (score > best) {
        best = score;
        localStorage.setItem('recipe_best', String(best));
        uiBest.innerText = best;
    }

    if (correct === total) {
        fb.className = 'feedback ok';
        fb.innerText = `Perfect! +${gained}`;
        notify('Correct! +' + gained, '#16a34a');
    } else {
        fb.className = 'feedback no';
        fb.innerText = `${correct}/${total} right (+${gained}). Correct amounts shown.`;
        notify('Not quite!', '#ef4444');
    }

    checked = true;
    actionBtn.innerText = (round >= MAX_ROUNDS) ? 'SEE RESULTS' : 'NEXT RECIPE';
}

function nextRound() {
    if (round >= MAX_ROUNDS) { endGame(); return; }
    round++;
    uiRound.innerText = round + '/' + MAX_ROUNDS;
    current = makeRound();
    render();
}

function startGame() {
    uiOverlay.classList.remove('visible');
    score = 0;
    round = 0;
    uiScore.innerText = 0;
    nextRound();
}

function endGame() {
    const pct = Math.round((score / (MAX_ROUNDS * 10)) * 100);
    let title;
    if (pct >= 85) title = 'Master Chef! 🏆';
    else if (pct >= 60) title = 'Great cooking! 👩‍🍳';
    else if (pct >= 35) title = 'Keep practising! 💪';
    else title = 'Try again!';
    uiTitle.innerText = title;
    uiDesc.innerHTML = `You scored <strong style="color:#f59e0b">${score}</strong> out of ${MAX_ROUNDS * 10}.<br><br>Use the ratio to scale every ingredient up or down.`;
    uiBtnStart.innerText = 'COOK AGAIN';
    uiOverlay.classList.add('visible');
}

function notify(msg, color) {
    const n = document.getElementById('notify');
    const t = document.getElementById('notify-text');
    t.innerText = msg;
    if (color) t.style.color = color;
    n.classList.remove('show');
    void n.offsetWidth;
    n.classList.add('show');
}

uiBtnStart.addEventListener('click', startGame);
