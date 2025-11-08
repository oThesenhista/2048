// game.js
const HIGH_SCORE_KEY = "rpg2048-highScore";
const THEME_KEY = "rpg2048-theme";

// Variáveis de Tema
let themeToggle;
let bodyElement;

// Variáveis de estado de pausa
let isGamePaused = false;
let pauseButton;

// Ordem de execução corrigida
window.onload = function() {
    themeToggle = document.getElementById("theme-toggle");
    bodyElement = document.body;
    pauseButton = document.getElementById("pause-btn");

    document.getElementById("restart-btn").addEventListener("click", restartGame);
    themeToggle.addEventListener("change", toggleTheme);
    pauseButton.addEventListener("click", togglePause);
    
    restartGame(); 
    loadTheme();
}

let board;
const rows = 4;
const cols = 4;
let gameWon = false; 

let enemiesDefeated = 0;
let currentEnemy;
let scoreDisplay = document.getElementById("score");
let enemiesDisplay = document.getElementById("enemies-defeated");

// ... (Variáveis de Ataque, Timers, etc.) ...
let blockAttackTimer = null;
let deleteAttackTimer = null;
const BLOCK_INTERVAL_START = 6000;
const DELETE_DELAY_MIN_START = 15000;
const DELETE_DELAY_MAX_START = 45000;
const BLOCK_DURATION_START = 3000;
let currentBlockInterval;
let currentDeleteMin;
let currentDeleteMax;
let currentBlockDuration;
let blockedSlots = [];
let maxBlocks = 1;
let isInputLocked = false;
const FAST_MOVE_THRESHOLD = 200;
let lastMoveTimestamp = 0;
let noMergeStreak = 0;


// --- Funções de Tema ---
function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    applyTheme(savedTheme || 'light');
}
function applyTheme(theme) {
    if (theme === 'dark') {
        bodyElement.classList.add("dark-theme");
        themeToggle.checked = true;
    } else {
        bodyElement.classList.remove("dark-theme");
        themeToggle.checked = false;
    }
    localStorage.setItem(THEME_KEY, theme);
    const newThemeColor = (theme === 'dark') ? '#424242' : '#bbada0';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', newThemeColor);
}
function toggleTheme() {
    applyTheme(themeToggle.checked ? 'dark' : 'light');
}

// --- Funções de Pausa ---
function setPauseOverlay(visible) {
    const overlay = document.getElementById("game-over-overlay");
    const text = document.getElementById("game-over-text");
    
    if (visible) {
        text.innerText = "Pausado";
        overlay.classList.add("visible");
        overlay.classList.remove("hidden");
    } else {
        overlay.classList.add("hidden");
        overlay.classList.remove("visible");
    }
}
function togglePause() {
    if (document.getElementById("game-over-overlay").classList.contains("visible") && document.getElementById("game-over-text").innerText !== "Pausado") {
        return;
    }
    isGamePaused = !isGamePaused;
    if (isGamePaused) {
        clearBlockTimer();
        clearDeleteTimer();
        setPauseOverlay(true);
        pauseButton.innerText = "▶";
    } else {
        setPauseOverlay(false);
        startBlockTimer();
        scheduleDeleteAttack();
        pauseButton.innerText = "II";
    }
}


// --- Funções de Recorde Local ---
function getHighScore() { return parseInt(localStorage.getItem(HIGH_SCORE_KEY) || "0"); }
function loadLocalHighScore() { document.getElementById("local-high-score").innerText = getHighScore(); }
function checkAndSaveHighScore() {
    const currentScore = enemiesDefeated;
    const highScore = getHighScore();
    if (currentScore > highScore) {
        localStorage.setItem(HIGH_SCORE_KEY, currentScore);
        loadLocalHighScore();
    }
}

// --- FUNÇÕES DE TIMER DE ATAQUE ---
function clearBlockTimer() { if (blockAttackTimer) { clearInterval(blockAttackTimer); blockAttackTimer = null; } }
function clearDeleteTimer() { if (deleteAttackTimer) { clearTimeout(deleteAttackTimer); deleteAttackTimer = null; } }
function startBlockTimer() {
    clearBlockTimer();
    blockAttackTimer = setInterval(blockSlotAttack, currentBlockInterval);
}
function scheduleDeleteAttack() {
    clearDeleteTimer();
    const delay = Math.random() * (currentDeleteMax - currentDeleteMin) + currentDeleteMin;
    deleteAttackTimer = setTimeout(deletePieceAttack, delay);
}

// --- FUNÇÕES DE ATAQUE ---
function blockSlotAttack() {
    if (isInputLocked || isGamePaused || blockedSlots.length >= maxBlocks) return; 
    let availableSlots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] >= 0) availableSlots.push({r, c});
    if (availableSlots.length === 0) return;
    let {r, c} = availableSlots[Math.floor(Math.random() * availableSlots.length)];
    const newBlockedSlot = { r, c, value: board[r][c] };
    blockedSlots.push(newBlockedSlot);
    board[r][c] = -1;
    updateBoardView([], [], [], [newBlockedSlot]); 
    setTimeout(() => unblockSlot(newBlockedSlot), currentBlockDuration); 
}
function deletePieceAttack() {
    applyPunishmentDeletions(1, scheduleDeleteAttack);
}
function unblockSlot(slotToUnblock) {
    if (isInputLocked) { setTimeout(() => unblockSlot(slotToUnblock), 100); return; }
    if (!slotToUnblock) return;
    const {r, c, value} = slotToUnblock;
    if (board[r][c] === -1) board[r][c] = value;
    blockedSlots = blockedSlots.filter(s => s.r !== r || s.c !== c);
    updateBoardView([], [], [], []);
}

// (Função selectTileToPunish - sem alterações)
function selectTileToPunish(boardState) {
    let buckets = { low: [], mid: [], high: [], epic: [] };
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const val = boardState[r][c];
            if (val > 0) {
                const tile = {r, c, val};
                if (val >= 256) buckets.epic.push(tile);
                else if (val >= 64) buckets.high.push(tile);
                else if (val >= 16) buckets.mid.push(tile);
                else buckets.low.push(tile);
            }
        }
    }
    const rand = Math.random();
    let chosenBucket;
    if (rand < 0.90) { chosenBucket = buckets.low; }
    else if (rand < 0.95) { chosenBucket = buckets.mid; }
    else if (rand < 0.98) { chosenBucket = buckets.high; }
    else { chosenBucket = buckets.epic; }
    if (chosenBucket.length === 0) {
        if (buckets.low.length > 0) chosenBucket = buckets.low;
        else if (buckets.mid.length > 0) chosenBucket = buckets.mid;
        else if (buckets.high.length > 0) chosenBucket = buckets.high;
        else if (buckets.epic.length > 0) chosenBucket = buckets.epic;
        else return null;
    }
    return chosenBucket[Math.floor(Math.random() * chosenBucket.length)];
}
// (applyPunishmentDeletions - sem alterações)
function applyPunishmentDeletions(count, onCompleteCallback) {
    if (isInputLocked || isGamePaused || currentEnemy.hp <= 0 || count <= 0) {
        if (onCompleteCallback) onCompleteCallback();
        return;
    }
    isInputLocked = true;
    let tilesToDelete = [];
    let tempBoard = JSON.parse(JSON.stringify(board)); 
    for (let i = 0; i < count; i++) {
        let tileToPick = selectTileToPunish(tempBoard);
        if (!tileToPick) break; 
        if (tileToPick.val > 128) {
            let deflectedTile = selectTileToPunish(tempBoard);
            if (deflectedTile) {
                tileToPick = deflectedTile;
            }
        }
        tilesToDelete.push(tileToPick);
        tempBoard[tileToPick.r][tileToPick.c] = 0; 
    }
    if (tilesToDelete.length === 0) {
        isInputLocked = false;
        if (onCompleteCallback) onCompleteCallback();
        return;
    }
    document.getElementById("game-board").classList.add("shake");
    updateBoardView([], [], tilesToDelete, []); 
    setTimeout(() => {
        for (const tile of tilesToDelete) {
            if (board[tile.r][tile.c] > 0) {
                 board[tile.r][tile.c] = 0;
            }
        }
        isInputLocked = false;
        document.getElementById("game-board").classList.remove("shake");
        updateBoardView([], [], [], []);
        if (onCompleteCallback) onCompleteCallback();
        checkGameOver();
    }, 600);
}


// --- LÓGICA PRINCIPAL DO JOGO ---
function restartGame() {
    enemiesDefeated = 0;
    clearBlockTimer();
    clearDeleteTimer();
    lastMoveTimestamp = 0;
    maxBlocks = 1;
    noMergeStreak = 0;
    resetLevel();
}
// (resetLevel - sem alterações)
function resetLevel() {
    board = [ [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0] ];
    gameWon = false;
    scoreDisplay.innerText = 0;
    enemiesDisplay.innerText = enemiesDefeated;
    clearBlockTimer();
    clearDeleteTimer();
    blockedSlots = [];
    isInputLocked = false;
    noMergeStreak = 0;
    isGamePaused = false; 
    const speedFactor = Math.pow(0.95, enemiesDefeated);
    maxBlocks = Math.min(3, 1 + Math.floor(enemiesDefeated / 4));
    if (maxBlocks === 1) currentBlockDuration = BLOCK_DURATION_START;
    else if (maxBlocks === 2) currentBlockDuration = 2500;
    else currentBlockDuration = 2000;
    currentBlockInterval = Math.max(2000, BLOCK_INTERVAL_START * speedFactor);
    currentDeleteMin = Math.max(10000, DELETE_DELAY_MIN_START * speedFactor);
    currentDeleteMax = Math.max(15000, DELETE_DELAY_MAX_START * speedFactor);
    document.getElementById("game-over-overlay").classList.remove("visible");
    document.getElementById("game-over-overlay").classList.add("hidden");
    pauseButton.innerText = "II";
    document.getElementById("enemy-defeated-overlay").classList.remove("visible");
    document.getElementById("enemy-condition-text").classList.remove("condition-shake");
    loadLocalHighScore();
    spawnNewEnemy();
    updateEnemyUI();
    const gameBoard = document.getElementById("game-board");
    gameBoard.innerHTML = ""; 
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        let cell = document.createElement("div");
        cell.classList.add("grid-cell");
        cell.id = `grid-cell-${r}-${c}`; 
        gameBoard.append(cell);
    }
    document.removeEventListener("keyup", handleKeyInput);
    document.addEventListener("keyup", handleKeyInput);
    gameBoard.removeEventListener('touchstart', handleTouchStart);
    gameBoard.addEventListener('touchstart', handleTouchStart, { passive: false });
    gameBoard.removeEventListener('touchend', handleTouchEnd);
    gameBoard.addEventListener('touchend', handleTouchEnd, { passive: false });
    let spawned1 = spawnNumber();
    let spawned2 = spawnNumber();
    updateBoardView([spawned1, spawned2], [], [], []);
    startBlockTimer();
    scheduleDeleteAttack();
}

// --- Grupos de Desafio (ALTERADO) ---
const challengePools = {
    easy: [
        { hp: 64, goalType: 'HP_DAMAGE', goalValue: null, text: "Condição: Cause 64 de dano" },
        // CORRIGIDO: Era 'MERGE_LIST' (vitória instantânea), agora é 'HP_FILTERED'
        { hp: 64, goalType: 'HP_FILTERED', goalValue: [4, 8], text: "Condição: Cause 64 de dano (Apenas 4, 8)" },
        { hp: 128, goalType: 'HP_DAMAGE', goalValue: null, text: "Condição: Cause 128 de dano" },
        { hp: 1, goalType: 'TARGET_MERGE', goalValue: [16], text: "Condição: Combine com o 16" },
        { hp: 1, goalType: 'BUILD_TILE', goalValue: [32], text: "Condição: Crie um 32" },
    ],
    boss_1: { hp: 1, goalType: 'BUILD_TILE', goalValue: [128], text: "CHEFE: Crie um 128!" },
    medium: [
        { hp: 256, goalType: 'HP_DAMAGE', goalValue: null, text: "Condição: Cause 256 de dano" },
        { hp: 256, goalType: 'HP_FILTERED', goalValue: [16, 32], text: "Condição: Dano Apenas com 16 ou 32" },
        { hp: 1, goalType: 'TARGET_MERGE', goalValue: [32], text: "Condição: Combine com o 32" },
        { hp: 1, goalType: 'BUILD_TILE', goalValue: [64], text: "Condição: Crie um 64" },
        { hp: 1, goalType: 'TARGET_MERGE', goalValue: [16, 16], text: "Condição: Combine com os dois 16" },
    ],
    boss_2: { hp: 1, goalType: 'BUILD_TILE', goalValue: [256], text: "CHEFE: Crie um 256!" },
    hard: [
        { hp: 512, goalType: 'HP_DAMAGE', goalValue: null, text: "Condição: Cause 512 de dano" },
        { hp: 512, goalType: 'HP_FILTERED', goalValue: [64, 128], text: "Condição: Dano Apenas com 64 ou 128" },
        { hp: 1, goalType: 'TARGET_MERGE', goalValue: [64], text: "Condição: Combine com o 64" },
        { hp: 1, goalType: 'TARGET_MERGE', goalValue: [32, 32], text: "Condição: Combine com os dois 32" },
    ],
    boss_3: { hp: 1, goalType: 'BUILD_TILE', goalValue: [512], text: "CHEFE: Crie um 512!" },
    epic: [
        { hp: 1024, goalType: 'HP_DAMAGE', goalValue: null, text: "Condição: Cause 1024 de dano" },
        { hp: 1024, goalType: 'HP_FILTERED', goalValue: [128, 256], text: "Condição: Dano Apenas com 128 ou 256" },
        { hp: 1, goalType: 'TARGET_MERGE', goalValue: [64, 64], text: "Condição: Combine com os dois 64" },
        { hp: 1, goalType: 'BUILD_TILE', goalValue: [512], text: "Condição: Crie um 512" },
    ],
    boss_4: { hp: 1, goalType: 'BUILD_TILE', goalValue: [1024], text: "CHEFE: Crie um 1024!" }
};
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ALTERADO: Adiciona 'targetsToHit'
function spawnNewEnemy() {
    let name = `Inimigo Nível ${enemiesDefeated + 1}`;
    let enemyRules;
    if ((enemiesDefeated + 1) % 10 === 0) {
        const bossLevel = (enemiesDefeated + 1) / 10;
        if (bossLevel === 1) enemyRules = challengePools.boss_1;
        else if (bossLevel === 2) enemyRules = challengePools.boss_2;
        else if (bossLevel === 3) enemyRules = challengePools.boss_3;
        else enemyRules = challengePools.boss_4;
    } else {
        if (enemiesDefeated < 9) {
            enemyRules = pickRandom(challengePools.easy);
        } else if (enemiesDefeated < 19) {
            enemyRules = pickRandom(challengePools.medium);
        } else if (enemiesDefeated < 29) {
            enemyRules = pickRandom(challengePools.hard);
        } else {
            enemyRules = pickRandom(challengePools.epic);
        }
    }
    let finalHP = enemyRules.hp;
    if (enemyRules.goalType !== 'HP_DAMAGE' && enemyRules.goalType !== 'HP_FILTERED') {
        finalHP = 1;
    }
    currentEnemy = {
        name: name,
        hp: finalHP,
        maxHp: finalHP,
        goalType: enemyRules.goalType,
        goalValue: enemyRules.goalValue,
        originalText: enemyRules.text,
        // CORRIGIDO: Cria uma cópia do array de alvos para podermos modificá-lo
        targetsToHit: (enemyRules.goalType === 'TARGET_MERGE') ? [...enemyRules.goalValue] : [],
    };
    if (currentEnemy.goalType === 'TARGET_MERGE') {
        currentEnemy.targetsToHit.forEach(value => { // Usa a cópia
            placeStaticTile(value);
        });
    }
    document.getElementById("enemy-name").innerText = currentEnemy.name;
}
// (placeStaticTile - sem alterações)
function placeStaticTile(value) {
    let emptyCells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] === 0) emptyCells.push({r, c});
    if (emptyCells.length > 0) {
        let {r, c} = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        board[r][c] = -value; 
    }
}

// ALTERADO: Atualiza o progresso do alvo
function updateEnemyUI() {
    const hpContainer = document.getElementById("enemy-hp-bar-outer");
    const hpText = document.getElementById("enemy-hp-text");
    const enemyContainer = document.getElementById("enemy-container");

    if (currentEnemy.goalType === 'HP_DAMAGE' || currentEnemy.goalType === 'HP_FILTERED') {
        hpContainer.style.display = 'block';
        hpText.style.display = 'flex';
        enemyContainer.classList.remove('no-hp-goal');
        const hpPercent = (currentEnemy.hp / currentEnemy.maxHp) * 100;
        document.getElementById("enemy-hp-bar-inner").style.width = `${Math.max(hpPercent, 0)}%`;
        hpText.innerText = `${Math.max(currentEnemy.hp, 0)} / ${currentEnemy.maxHp}`;
    } else {
        hpContainer.style.display = 'none';
        hpText.style.display = 'none';
        enemyContainer.classList.add('no-hp-goal');
    }
    
    // CORRIGIDO: Lógica de progresso
    let conditionText = currentEnemy.originalText;
    if (currentEnemy.goalType === 'TARGET_MERGE') {
        let total = currentEnemy.goalValue.length; // Lê o total do original
        let remaining = currentEnemy.targetsToHit.length; // Lê o restante da cópia
        if (remaining < total) {
            conditionText = `${currentEnemy.originalText} (${total - remaining}/${total})`;
        }
    }
    document.getElementById("enemy-condition-text").innerText = conditionText;
}

// ALTERADO: Lógica de dano refatorada
function applyDamage(damageValues, targetMerges) {
    if (currentEnemy.hp <= 0) return;
    let totalValidDamage = 0;
    let didResist = false;
    let instantWin = false;

    switch (currentEnemy.goalType) {
        case 'HP_DAMAGE':
            totalValidDamage = damageValues.reduce((a, b) => a + b, 0);
            break;
        case 'HP_FILTERED': // Inimigo "Combine 4 ou 8 + HP"
            if (damageValues.length > 0) {
                for (const val of damageValues) {
                    if (currentEnemy.goalValue.includes(val)) {
                        totalValidDamage += val;
                    } else {
                        didResist = true; // Fez uma soma, mas não era a correta
                    }
                }
            }
            break;

        case 'MERGE_LIST': // Ex: "Faça uma soma de 16 ou 32"
        case 'BUILD_TILE': // Ex: "Crie um 128"
            if (damageValues.length > 0) {
                for (const val of damageValues) {
                    if (currentEnemy.goalValue.includes(val)) {
                        instantWin = true;
                    } else {
                        didResist = true;
                    }
                }
            }
            break;

        case 'TARGET_MERGE':
            if (targetMerges.length > 0) {
                for (const val of targetMerges) {
                    // CORRIGIDO: Verifica e remove da lista de alvos restantes
                    const targetIndex = currentEnemy.targetsToHit.indexOf(val);
                    if (targetIndex > -1) {
                        currentEnemy.targetsToHit.splice(targetIndex, 1);
                    }
                }
                if (currentEnemy.targetsToHit.length === 0) {
                    instantWin = true;
                }
            }
            if (damageValues.length > 0) didResist = true;
            break;
    }

    let conditionTextElement = document.getElementById("enemy-condition-text");
    if (didResist && !instantWin) {
        conditionTextElement.classList.add("condition-shake");
        setTimeout(() => { conditionTextElement.classList.remove("condition-shake"); }, 400);
    } else {
        conditionTextElement.classList.remove("condition-shake");
    }

    scoreDisplay.innerText = totalValidDamage;
    if (totalValidDamage > 0) {
        currentEnemy.hp -= totalValidDamage;
    }

    // Atualiza a UI (barra de HP ou progresso de alvos)
    updateEnemyUI();

    if (instantWin || currentEnemy.hp <= 0) {
        currentEnemy.hp = 0;
        enemiesDefeated++;
        clearBlockTimer();
        clearDeleteTimer();
        isInputLocked = true;
        document.getElementById("enemy-defeated-text").innerText = `${currentEnemy.name} Derrotado!`;
        document.getElementById("enemy-defeated-overlay").classList.add("visible");
        setTimeout(() => {
            document.getElementById("enemy-defeated-overlay").classList.remove("visible");
            resetLevel(); 
        }, 1500);
    }
}


// --- LÓGICA DO 2048 ---
// (updateBoardView, spawnNumber, processMove, handleKeyInput, handleTouchStart, 
//  handleTouchEnd, handleSwipe, boardHasTile, slide, slideLeft, slideRight, 
//  slideUp, slideDown - todas sem alterações)
function updateBoardView(spawnedTiles, mergedTiles, deletedTiles = [], blockedTiles = []) {
    const spawnedKeys = new Set(spawnedTiles.map(t => `${t.r}-${t.c}`));
    const mergedKeys = new Set(mergedTiles.map(t => `${t.r}-${t.c}`));
    const deletedKeys = new Set(deletedTiles.map(t => `${t.r}-${t.c}`));
    const blockedKeys = new Set(blockedTiles.map(t => `${t.r}-${t.c}`));
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.getElementById(`grid-cell-${r}-${c}`);
            cell.innerHTML = ""; 
            let value = board[r][c];
            if (value > 0) {
                let tile = document.createElement("div");
                tile.classList.add("tile");
                tile.classList.add("tile-" + value);
                tile.innerText = value;
                const key = `${r}-${c}`;
                if (deletedKeys.has(key)) { tile.classList.add("tile-deleted"); } 
                else {
                    if (spawnedKeys.has(key)) tile.classList.add("tile-new");
                    if (mergedKeys.has(key)) tile.classList.add("tile-merged");
                }
                cell.append(tile);
            } else if (value < -1) {
                let posValue = Math.abs(value);
                let tile = document.createElement("div");
                tile.classList.add("tile");
                tile.classList.add("tile-static");
                tile.classList.add("tile-static-" + posValue);
                tile.innerText = posValue;
                cell.append(tile);
            } else if (value === -1) {
                let tile = document.createElement("div");
                tile.classList.add("tile");
                tile.classList.add("tile-blocked-style"); 
                tile.innerText = "X";
                const key = `${r}-${c}`;
                if (blockedKeys.has(key)) {
                    tile.classList.add("tile-blocked");
                }
                cell.append(tile);
            }
        }
    }
}
function spawnNumber() {
    let emptyCells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] === 0) emptyCells.push({r, c});
    if (emptyCells.length === 0) return null;
    let randIndex = Math.floor(Math.random() * emptyCells.length);
    let {r, c} = emptyCells[randIndex];
    let value = Math.random() < 0.9 ? 2 : 4;
    board[r][c] = value;
    return {r, c};
}
function processMove(slideResult, isFastMove) {
    let { hasChanged, mergedTiles, totalDamageValues, targetMerges } = slideResult;
    let deletionsToApply = 0;
    if (hasChanged) {
        if (isFastMove) {
            deletionsToApply++;
        }
        if (totalDamageValues.length === 0 && targetMerges.length === 0) {
            if (boardHasTile(16)) {
                noMergeStreak++;
                if (noMergeStreak >= 3) {
                    deletionsToApply++;
                    noMergeStreak = 0;
                }
            }
        } else {
            noMergeStreak = 0;
        }
        applyDamage(totalDamageValues, targetMerges);
        updateBoardView([], mergedTiles, [], []);
        if (currentEnemy.hp > 0) {
            if (deletionsToApply > 0) {
                applyPunishmentDeletions(deletionsToApply, null);
            }
            setTimeout(() => {
                const spawnedTile = spawnNumber();
                updateBoardView(spawnedTile ? [spawnedTile] : [], [], [], []);
                checkWin();
                checkGameOver();
            }, 100); 
        }
    } else {
        scoreDisplay.innerText = 0;
    }
}
function handleKeyInput(e) {
    const now = Date.now();
    const isFastMove = (now - lastMoveTimestamp) < FAST_MOVE_THRESHOLD;
    lastMoveTimestamp = now;
    if (isGamePaused || isInputLocked || currentEnemy.hp <= 0 || document.getElementById("game-over-overlay").classList.contains("visible") || gameWon) {
        return;
    }
    let slideFn = null;
    switch(e.key) {
        case "ArrowLeft": slideFn = slideLeft; break;
        case "ArrowRight": slideFn = slideRight; break;
        case "ArrowUp": slideFn = slideUp; break;
        case "ArrowDown": slideFn = slideDown; break;
        default: return;
    }
    let slideResult = slideFn(board);
    if (slideResult.hasChanged) {
        board = slideResult.board;
    }
    processMove(slideResult, isFastMove);
}
function handleTouchStart(e) {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}
function handleTouchEnd(e) {
    e.preventDefault();
    const now = Date.now();
    const isFastMove = (now - lastMoveTimestamp) < FAST_MOVE_THRESHOLD;
    lastMoveTimestamp = now;
    if (isGamePaused || isInputLocked || currentEnemy.hp <= 0 || document.getElementById("game-over-overlay").classList.contains("visible") || gameWon) {
        return;
    }
    let touchEndX = e.changedTouches[0].clientX;
    let touchEndY = e.changedTouches[0].clientY;
    handleSwipe(touchEndX, touchEndY, isFastMove);
}
function handleSwipe(endX, endY, isFastMove) {
    let deltaX = endX - touchStartX;
    let deltaY = endY - touchStartY;
    let absDeltaX = Math.abs(deltaX);
    let absDeltaY = Math.abs(deltaY);
    const minSwipeDistance = 30;
    let slideFn = null;
    if (absDeltaX > absDeltaY) {
        if (absDeltaX > minSwipeDistance) {
            slideFn = (deltaX < 0) ? slideLeft : slideRight;
        }
    } else {
        if (absDeltaY > minSwipeDistance) {
            slideFn = (deltaY < 0) ? slideUp : slideDown;
        }
    }
    if (slideFn) {
        let slideResult = slideFn(board);
        if (slideResult.hasChanged) {
            board = slideResult.board;
        }
        processMove(slideResult, isFastMove);
    }
}
function boardHasTile(value) {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] >= value) {
                return true;
            }
        }
    }
    return false;
}
function slide(row) {
    let newRow = new Array(cols).fill(0);
    let mergedIndices = [];
    let moveDamageValues = [];
    let targetMerges = [];
    let start = 0;
    for (let i = 0; i <= cols; i++) {
        if (i === cols || row[i] === -1) {
            let segment = row.slice(start, i);
            if (segment.length === 0) { 
                if (i < cols) newRow[i] = -1;
                start = i + 1;
                continue;
            }
            let filteredSegment = segment.filter(num => num !== 0); 
            let originalMergedIndices = [];
            for (let j = 0; j < filteredSegment.length - 1; j++) {
                let current = filteredSegment[j];
                let next = filteredSegment[j+1];
                if (current > 0 && current === next) {
                    filteredSegment[j] *= 2;
                    moveDamageValues.push(filteredSegment[j]);
                    filteredSegment[j+1] = 0;
                    originalMergedIndices.push(j);
                } 
                else if (current > 0 && next < -1 && current === Math.abs(next)) {
                    filteredSegment[j] = 0;
                    filteredSegment[j+1] = 0;
                    targetMerges.push(current);
                }
                else if (current < -1 && next > 0 && Math.abs(current) === next) {
                    filteredSegment[j] = 0;
                    filteredSegment[j+1] = 0;
                    targetMerges.push(next);
                }
            }
            let slidSegment = filteredSegment.filter(num => num !== 0);
            let slidMergedIndices = [];
            let mergeIdx = 0;
            for(let k=0; k < slidSegment.length; k++) {
                while(mergeIdx < originalMergedIndices.length && filteredSegment.slice(0, originalMergedIndices[mergeIdx]+1).filter(n => n !== 0).length <= k) mergeIdx++;
                if (mergeIdx < originalMergedIndices.length && filteredSegment.slice(0, originalMergedIndices[mergeIdx]+1).filter(n => n !== 0).length === k + 1) slidMergedIndices.push(k);
            }
            let tileIdx = 0;
            for (let j = start; j < i; j++) {
                if (tileIdx < slidSegment.length) {
                    newRow[j] = slidSegment[tileIdx];
                    if (slidMergedIndices.includes(tileIdx)) {
                        mergedIndices.push(j);
                    }
                    tileIdx++;
                }
            }
            if (i < cols) { newRow[i] = -1; }
            start = i + 1;
        }
    }
    return { newRow, mergedIndices, moveDamageValues, targetMerges };
}
function slideLeft(inputBoard) {
    let newBoard = JSON.parse(JSON.stringify(inputBoard));
    let hasChanged = false, mergedTiles = [], totalDamageValues = [], totalTargetMerges = []; 
    for (let r = 0; r < rows; r++) {
        let row = newBoard[r];
        let { newRow, mergedIndices, moveDamageValues, targetMerges } = slide(row);
        newBoard[r] = newRow;
        totalDamageValues.push(...moveDamageValues);
        totalTargetMerges.push(...targetMerges);
        for (let c of mergedIndices) mergedTiles.push({r: r, c: c});
    }
    hasChanged = JSON.stringify(newBoard) !== JSON.stringify(inputBoard);
    return { board: newBoard, hasChanged, mergedTiles, totalDamageValues, targetMerges: totalTargetMerges };
}
function slideRight(inputBoard) {
    let newBoard = JSON.parse(JSON.stringify(inputBoard));
    let hasChanged = false, mergedTiles = [], totalDamageValues = [], totalTargetMerges = [];
    for (let r = 0; r < rows; r++) {
        let row = newBoard[r];
        let reversedRow = row.reverse();
        let { newRow: newReversedRow, mergedIndices: reversedMergedIndices, moveDamageValues, targetMerges } = slide(reversedRow);
        totalDamageValues.push(...moveDamageValues); 
        totalTargetMerges.push(...targetMerges);
        let newRow = newReversedRow.reverse();
        newBoard[r] = newRow;
        for (let c_rev of reversedMergedIndices) mergedTiles.push({r: r, c: cols - 1 - c_rev});
    }
    hasChanged = JSON.stringify(newBoard) !== JSON.stringify(inputBoard);
    return { board: newBoard, hasChanged, mergedTiles, totalDamageValues, targetMerges: totalTargetMerges };
}
function slideUp(inputBoard) {
    let newBoard = JSON.parse(JSON.stringify(inputBoard));
    let hasChanged = false, mergedTiles = [], totalDamageValues = [], totalTargetMerges = [];
    for (let c = 0; c < cols; c++) {
        let column = [];
        for (let r = 0; r < rows; r++) column.push(newBoard[r][c]);
        let { newRow: newColumn, mergedIndices, moveDamageValues, targetMerges } = slide(column);
        totalDamageValues.push(...moveDamageValues);
        totalTargetMerges.push(...targetMerges);
        for (let r_idx of mergedIndices) mergedTiles.push({r: r_idx, c: c});
        for (let r = 0; r < rows; r++) {
            newBoard[r][c] = newColumn[r];
        }
    }
    hasChanged = JSON.stringify(newBoard) !== JSON.stringify(inputBoard);
    return { board: newBoard, hasChanged, mergedTiles, totalDamageValues, targetMerges: totalTargetMerges };
}
function slideDown(inputBoard) {
    let newBoard = JSON.parse(JSON.stringify(inputBoard));
    let hasChanged = false, mergedTiles = [], totalDamageValues = [], totalTargetMerges = [];
    for (let c = 0; c < cols; c++) {
        let column = [];
        for (let r = 0; r < rows; r++) column.push(newBoard[r][c]);
        let reversedColumn = column.reverse();
        let { newRow: newReversedColumn, mergedIndices: reversedMergedIndices, moveDamageValues, targetMerges } = slide(reversedColumn);
        totalDamageValues.push(...moveDamageValues); 
        totalTargetMerges.push(...targetMerges);
        let newColumn = newReversedColumn.reverse();
        for (let r_rev of reversedMergedIndices) mergedTiles.push({r: rows - 1 - r_rev, c: c});
        for (let r = 0; r < rows; r++) {
            newBoard[r][c] = newColumn[r];
        }
    }
    hasChanged = JSON.stringify(newBoard) !== JSON.stringify(inputBoard);
    return { board: newBoard, hasChanged, mergedTiles, totalDamageValues, targetMerges: totalTargetMerges };
}

// --- VERIFICAÇÃO DE FIM DE JOGO ---
function showGameOverOverlay(message) {
    document.getElementById("game-over-text").innerText = message;
    let overlay = document.getElementById("game-over-overlay");
    overlay.classList.remove("hidden");
    overlay.classList.add("visible");
    clearBlockTimer();
    clearDeleteTimer();
    isGamePaused = true;
    checkAndSaveHighScore();
}
function checkGameOver() {
    if (gameWon || document.getElementById("game-over-overlay").classList.contains("visible")) { 
        return; 
    }
    let hasTiles = false;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) { if (board[r][c] > 0) { hasTiles = true; break; } }
        if (hasTiles) break;
    }
    if (!hasTiles) { showGameOverOverlay("Você não tem mais peças!"); return; }
    let hasEmptyCell = false;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) { if (board[r][c] === 0) { hasEmptyCell = true; break; } }
        if (hasEmptyCell) break;
    }
    if (hasEmptyCell) { return; }
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
            let curr = board[r][c];
            let next = board[r][c+1];
            if (curr > 0 && curr === next) return;
            if (curr > 0 && next < -1 && curr === Math.abs(next)) return;
            if (curr < -1 && next > 0 && Math.abs(curr) === next) return;
        }
    }
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows - 1; r++) {
            let curr = board[r][c];
            let next = board[r+1][c];
            if (curr > 0 && curr === next) return;
            if (curr > 0 && next < -1 && curr === Math.abs(next)) return;
            if (curr < -1 && next > 0 && Math.abs(curr) === next) return;
        }
    }
    showGameOverOverlay("Sem movimentos!");
}
// (checkWin - sem alterações)
function checkWin() {
    if (gameWon) return;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] === 2048) { alert("Você Venceu! (o 2048)"); gameWon = true; }
        }
    }
}