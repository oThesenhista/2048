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
    
    // Listeners de Debug (agora ocultos, mas funcionais se o CSS for mudado)
    document.getElementById("debug-win-level").addEventListener("click", forceWinLevel);
    document.getElementById("debug-burn").addEventListener("click", applyBurnDamage);
    document.getElementById("debug-freeze").addEventListener("click", freezeSlotAttack);
    document.getElementById("debug-ghost").addEventListener("click", ghostSlotAttack);
    document.getElementById("debug-block").addEventListener("click", blockSlotAttack);
    document.getElementById("debug-delete").addEventListener("click", deletePieceAttack);
    document.getElementById("debug-shuffle").addEventListener("click", shuffleAttack);
    
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

// --- VARIÁVEIS DE ATAQUE ---
let blockAttackTimer = null;
let deleteAttackTimer = null;
let burnTimer = null;
let freezeTimer = null;
let ghostTimer = null;
let shuffleTimer = null;

// --- Constantes de Ataque ---
const BLOCK_INTERVAL_START = 12000;
const DELETE_DELAY_MIN_START = 15000;
const DELETE_DELAY_MAX_START = 45000;
const BURN_INTERVAL_START = 30000;
const FREEZE_INTERVAL_START = 10000;
const GHOST_INTERVAL_START = 12000;
const SHUFFLE_INTERVAL_START = 15000;
const BLOCK_DURATION = 2000;
const GHOST_DURATION = 8000;
const FREEZE_HITS = 2;

// --- Estado dos Ataques ---
let currentBlockInterval;
let currentDeleteMin;
let currentDeleteMax;
let currentBurnInterval;
let currentFreezeInterval;
let currentGhostInterval;
let currentShuffleInterval;
let currentBlockDuration;
let blockedSlots = [];
let frozenSlots = [];
let ghostSlots = [];
let maxBlocks = 1;

// --- Estado do Jogo ---
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
        clearAllTimers();
        setPauseOverlay(true);
        pauseButton.innerText = "▶";
    } else {
        setPauseOverlay(false);
        startAllTimers();
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
function clearBurnTimer() { if (burnTimer) { clearInterval(burnTimer); burnTimer = null; } }
function clearFreezeTimer() { if (freezeTimer) { clearInterval(freezeTimer); freezeTimer = null; } }
function clearGhostTimer() { if (ghostTimer) { clearInterval(ghostTimer); ghostTimer = null; } }
function clearShuffleTimer() { if (shuffleTimer) { clearInterval(shuffleTimer); shuffleTimer = null; } }

function clearAllTimers() {
    clearBlockTimer();
    clearDeleteTimer();
    clearBurnTimer();
    clearFreezeTimer();
    clearGhostTimer();
    clearShuffleTimer();
}

function startBlockTimer() {
    clearBlockTimer();
    if (currentEnemy.canBlock) {
        blockAttackTimer = setInterval(blockSlotAttack, currentBlockInterval);
    }
}
function scheduleDeleteAttack() {
    clearDeleteTimer();
    if (currentEnemy.canDelete) {
        const delay = Math.random() * (currentDeleteMax - currentDeleteMin) + currentDeleteMin;
        deleteAttackTimer = setTimeout(deletePieceAttack, delay);
    }
}
function startBurnTimer() {
    clearBurnTimer();
    if (currentEnemy.canBurn) {
        burnTimer = setInterval(applyBurnDamage, currentBurnInterval);
    }
}
function startFreezeTimer() {
    clearFreezeTimer();
    if (currentEnemy.canFreeze) {
        freezeTimer = setInterval(freezeSlotAttack, currentFreezeInterval);
    }
}
function startGhostTimer() {
    clearGhostTimer();
    if (currentEnemy.canGhost) {
        ghostTimer = setInterval(ghostSlotAttack, currentGhostInterval);
    }
}
function startShuffleTimer() {
    clearShuffleTimer();
    if (currentEnemy.canShuffle) {
        shuffleTimer = setInterval(shuffleAttack, currentShuffleInterval);
    }
}

function startAllTimers() {
    scheduleDeleteAttack();
    startBlockTimer();
    startBurnTimer();
    startFreezeTimer();
    startGhostTimer();
    startShuffleTimer();
}

// --- FUNÇÕES DE ATAQUE ---

// Ataque: Bloqueio (Nível 10-19 / 60-69 / ...)
function blockSlotAttack() {
    if (isInputLocked || isGamePaused || blockedSlots.length >= maxBlocks) return; 
    let availableSlots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] >= 0) availableSlots.push({r, c});
    if (availableSlots.length === 0) return;
    let {r, c} = availableSlots[Math.floor(Math.random() * availableSlots.length)];
    const newBlockedSlot = { r, c, value: board[r][c] };
    blockedSlots.push(newBlockedSlot);
    board[r][c] = -1; // -1 = Bloqueado
    updateBoardView([], [], [], [newBlockedSlot], [], [], []);
    setTimeout(() => unblockSlot(newBlockedSlot), currentBlockDuration); 
}
function unblockSlot(slotToUnblock) {
    if (isInputLocked) { setTimeout(() => unblockSlot(slotToUnblock), 100); return; }
    if (!slotToUnblock) return;
    const {r, c, value} = slotToUnblock;
    if (board[r][c] === -1) board[r][c] = value;
    blockedSlots = blockedSlots.filter(s => s.r !== r || s.c !== c);
    updateBoardView([], [], [], [], [], [], []);
}

// Punição: Deleção (Sempre Ativa)
function deletePieceAttack() {
    applyPunishmentDeletions(1, scheduleDeleteAttack);
}

// Ataque: Queimadura (Nível 20-29 / 70-79 / ...)
function applyBurnDamage() {
    if (isInputLocked || isGamePaused || currentEnemy.hp <= 0) return;
    
    let targets = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] >= 16) {
                // CORREÇÃO: Salva o valor no momento da seleção
                targets.push({r, c, val: board[r][c]}); 
            }
        }
    }
    if (targets.length === 0) return;

    isInputLocked = true;
    let tilesToBurn = [];
    const targetCount = 1;
    
    for (let i = 0; i < targetCount; i++) {
         if (targets.length === 0) break;
         let randIndex = Math.floor(Math.random() * targets.length);
         let tile = targets.splice(randIndex, 1)[0];
         tilesToBurn.push(tile);
    }

    updateBoardView([], [], [], [], tilesToBurn, [], []); 

    setTimeout(() => {
        let spawnedAfterBurn = [];
        for (const tile of tilesToBurn) {
            // CORREÇÃO: Usa o valor salvo (tile.val) em vez de ler o tabuleiro de novo
            let newValue = Math.floor(tile.val / 2); 
            board[tile.r][tile.c] = newValue;
            if (newValue > 0) {
                spawnedAfterBurn.push({r: tile.r, c: tile.c});
            }
        }
        isInputLocked = false;
        updateBoardView(spawnedAfterBurn, [], [], [], [], [], []);
        checkGameOver();
    }, 700);
}

// Ataque: Congelamento (Nível 30-39 / 80-89 / ...)
function freezeSlotAttack() {
    // CORREÇÃO: Limita a 1 peça congelada
    if (isInputLocked || isGamePaused || frozenSlots.length >= 1) return;
    let availableSlots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] > 0) availableSlots.push({r, c});
    if (availableSlots.length === 0) return;
    
    let {r, c} = availableSlots[Math.floor(Math.random() * availableSlots.length)];
    const newFrozenSlot = { r, c, value: board[r][c], hits: FREEZE_HITS };
    frozenSlots.push(newFrozenSlot);
    board[r][c] = -2; // -2 = Congelado
    updateBoardView([], [], [], [], [], [newFrozenSlot], []);
}

// Ataque: Fantasma (Nível 40-49 / 90-99 / ...)
function ghostSlotAttack() {
    // CORREÇÃO: Limita a 1 peça fantasma
    if (isInputLocked || isGamePaused || ghostSlots.length >= 1) return;
    let availableSlots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] > 0) availableSlots.push({r, c});
    if (availableSlots.length === 0) return;
    
    let {r, c} = availableSlots[Math.floor(Math.random() * availableSlots.length)];
    const newGhostSlot = { r, c, value: board[r][c] };
    ghostSlots.push(newGhostSlot);
    board[r][c] = -3; // -3 = Fantasma
    updateBoardView([], [], [], [], [], [], [newGhostSlot]);
    
    setTimeout(() => unghostSlot(newGhostSlot), GHOST_DURATION);
}
function unghostSlot(slotToUnghost) {
    if (isInputLocked) { setTimeout(() => unghostSlot(slotToUnghost), 100); return; }
    if (!slotToUnghost) return;
    
    const {r, c, value} = slotToUnghost;
    // Só restaura se o slot ainda for fantasma (pode ter sido embaralhado)
    let currentGhost = ghostSlots.find(s => s.r === r && s.c === c);
    
    if (currentGhost && board[r][c] === -3) {
        board[r][c] = value;
    }
    ghostSlots = ghostSlots.filter(s => s.r !== r || s.c !== c);
    updateBoardView([], [], [], [], [], [], []);
}

// Ataque: Embaralhar (Chefes Nível 50+)
function shuffleAttack() {
    if (isInputLocked || isGamePaused) return;
    
    isInputLocked = true;
    
    let currentTiles = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            currentTiles.push({ r, c, value: board[r][c] });
        }
    }
    
    let newPositions = currentTiles.map(t => ({ r: t.r, c: t.c }));
    newPositions.sort(() => Math.random() - 0.5); // Embaralha posições

    let oldFrozen = JSON.parse(JSON.stringify(frozenSlots));
    let oldGhost = JSON.parse(JSON.stringify(ghostSlots));
    let oldBlocked = JSON.parse(JSON.stringify(blockedSlots));
    
    frozenSlots = [];
    ghostSlots = [];
    blockedSlots = [];
    
    let shuffledTilesAnim = [];
    
    for (let i = 0; i < currentTiles.length; i++) {
        let oldPos = currentTiles[i];
        let newPos = newPositions[i];
        
        board[newPos.r][newPos.c] = oldPos.value;
        
        if (oldPos.value !== 0) {
            shuffledTilesAnim.push(newPos);
        }

        // Mapeia os metadados (hits, etc.) para a nova posição
        let frozen = oldFrozen.find(s => s.r === oldPos.r && s.c === oldPos.c);
        if (frozen) frozenSlots.push({ ...frozen, r: newPos.r, c: newPos.c });
        
        let ghost = oldGhost.find(s => s.r === oldPos.r && s.c === oldPos.c);
        if (ghost) ghostSlots.push({ ...ghost, r: newPos.r, c: newPos.c });
        
        let blocked = oldBlocked.find(s => s.r === oldPos.r && s.c === oldPos.c);
        if (blocked) blockedSlots.push({ ...blocked, r: newPos.r, c: newPos.c });
    }
    
    document.getElementById("game-board").classList.add("shake");
    updateBoardView([], [], [], [], [], [], [], shuffledTilesAnim);
    
    setTimeout(() => {
        isInputLocked = false;
        document.getElementById("game-board").classList.remove("shake");
        updateBoardView([], [], [], [], [], [], []);
        checkGameOver();
    }, 600);
}


// --- Punições Base (Deleção / Spam / Ineficiência) ---
function selectTileToPunish(boardState) {
    let buckets = { low: [], mid: [], high: [], epic: [] };
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const val = boardState[r][c];
            if (val > 0) {
                const tile = {r, c, val};
                // 90% de chance de atingir peças de valor baixo (2, 4, 8)
                if (val <= 8) buckets.low.push(tile);
                else if (val <= 32) buckets.mid.push(tile);
                else if (val <= 128) buckets.high.push(tile);
                else buckets.epic.push(tile);
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
        
        // Deflexão de peças de alto valor (mantida)
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
    updateBoardView([], [], tilesToDelete, [], [], [], []); 
    setTimeout(() => {
        for (const tile of tilesToDelete) {
            if (board[tile.r][tile.c] > 0) {
                 board[tile.r][tile.c] = 0;
            }
        }
        isInputLocked = false;
        document.getElementById("game-board").classList.remove("shake");
        updateBoardView([], [], [], [], [], [], []);
        if (onCompleteCallback) onCompleteCallback();
        checkGameOver();
    }, 400); // CORREÇÃO: Reduzido de 1400ms para 400ms
}


// --- LÓGICA PRINCIPAL DO JOGO ---
function restartGame() {
    enemiesDefeated = 0;
    clearAllTimers();
    lastMoveTimestamp = 0;
    maxBlocks = 1;
    noMergeStreak = 0;
    resetLevel();
}
function resetLevel() {
    board = [ [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0] ];
    gameWon = false;
    scoreDisplay.innerText = 0;
    enemiesDisplay.innerText = enemiesDefeated;
    clearAllTimers();
    blockedSlots = [];
    frozenSlots = [];
    ghostSlots = [];
    isInputLocked = false;
    noMergeStreak = 0;
    isGamePaused = false; 
    
    // Fator de velocidade (aumenta a dificuldade com o tempo)
    const speedFactor = Math.pow(0.95, enemiesDefeated);
    maxBlocks = Math.min(3, 1 + Math.floor(enemiesDefeated / 4));
    
    currentBlockDuration = BLOCK_DURATION; 
    
    currentBlockInterval = Math.max(5000, BLOCK_INTERVAL_START * speedFactor);
    currentDeleteMin = Math.max(10000, DELETE_DELAY_MIN_START * speedFactor);
    currentDeleteMax = Math.max(15000, DELETE_DELAY_MAX_START * speedFactor);
    currentBurnInterval = Math.max(10000, BURN_INTERVAL_START * speedFactor);
    currentFreezeInterval = Math.max(4000, FREEZE_INTERVAL_START * speedFactor);
    currentGhostInterval = Math.max(5000, GHOST_INTERVAL_START * speedFactor);
    currentShuffleInterval = Math.max(8000, SHUFFLE_INTERVAL_START * speedFactor);
    
    document.getElementById("game-over-overlay").classList.remove("visible");
    document.getElementById("game-over-overlay").classList.add("hidden");
    pauseButton.innerText = "II";
    document.getElementById("enemy-defeated-overlay").classList.remove("visible");
    document.getElementById("enemy-condition-text").classList.remove("condition-shake");
    
    loadLocalHighScore();
    spawnNewEnemy(); // Define currentEnemy e suas mecânicas
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
    updateBoardView([spawned1, spawned2], [], [], [], [], [], []);
    
    startAllTimers(); // Inicia os timers com base nas mecânicas do inimigo
}

// --- Grupos de Desafio ---
const challengePools = {
    easy: [
        { hp: 64, goalType: 'HP_DAMAGE', goalValue: null, text: "Condição: Cause 64 de dano" },
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
// (pickRandom - sem alterações)
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// (spawnNewEnemy - REFEITO COM ETAPAS)
function spawnNewEnemy() {
    let level = enemiesDefeated;
    let name = `Inimigo Nível ${level + 1}`;
    
    // 1. Definir Mecânicas da Etapa
    let mechanics = {
        canDelete: true, // Punição Base sempre ativa
        canBlock: false,
        canBurn: false,
        canFreeze: false,
        canGhost: false,
        canShuffle: false
    };
    
    let challengePool;
    let isBoss = (level + 1) % 10 === 0;

    if (level <= 8) { // Nível 1-9: Base
        challengePool = challengePools.easy;
    } else if (level === 9) { // Chefe 10
        mechanics.canBlock = true;
        challengePool = challengePools.boss_1;
    } else if (level <= 18) { // Nível 11-19: Bloqueio
        mechanics.canBlock = true;
        challengePool = challengePools.medium;
    } else if (level === 19) { // Chefe 20
        mechanics.canBurn = true;
        challengePool = challengePools.boss_2;
    } else if (level <= 28) { // Nível 21-29: Queimadura
        mechanics.canBurn = true;
        challengePool = challengePools.hard;
    } else if (level === 29) { // Chefe 30
        mechanics.canFreeze = true;
        challengePool = challengePools.boss_3;
    } else if (level <= 38) { // Nível 31-39: Congelamento
        mechanics.canFreeze = true;
        challengePool = challengePools.epic; // Aumenta a dificuldade do pool
    } else if (level === 39) { // Chefe 40
        mechanics.canGhost = true;
        challengePool = challengePools.boss_4;
    } else if (level <= 48) { // Nível 41-49: Fantasma
        mechanics.canGhost = true;
        challengePool = challengePools.epic;
    } else if (level === 49) { // Chefe 50
        mechanics.canShuffle = true;
        challengePool = challengePools.boss_4;
    } else { // Nível 51+ (Ciclo Épico)
        challengePool = challengePools.epic;
        
        if (isBoss) {
            mechanics.canShuffle = true;
        }
        
        // O ciclo de mecânicas repete a cada 10 níveis, exceto o primeiro (50-59)
        // 50-59: Base (idx 0)
        // 60-69: Block (idx 1)
        // 70-79: Burn (idx 2)
        // 80-89: Freeze (idx 3)
        // 90-99: Ghost (idx 4)
        // 100-109: Base (idx 5 % 5 = 0)
        const stage = Math.floor((level - 50) / 10) % 5; 
        
        switch(stage) {
            case 0: break; // Base (50-59, 100-109, ...)
            case 1: mechanics.canBlock = true; break;  // (60-69, 110-119, ...)
            case 2: mechanics.canBurn = true; break;   // (70-79, 120-129, ...)
            case 3: mechanics.canFreeze = true; break; // (80-89, 130-139, ...)
            case 4: mechanics.canGhost = true; break;  // (90-99, 140-149, ...)
        }
    }

    // 2. Escolher Regra de Vitória
    let enemyRules = (isBoss && challengePools[`boss_${(level + 1) / 10}`])
        ? challengePools[`boss_${(level + 1) / 10}`] // Bosses 10, 20, 30, 40
        : (isBoss && challengePools.boss_4) // Bosses 50+ usam o boss_4
        ? challengePools.boss_4
        : pickRandom(challengePool);

    let finalHP = enemyRules.hp;
    if (enemyRules.goalType !== 'HP_DAMAGE' && enemyRules.goalType !== 'HP_FILTERED') {
        finalHP = 1;
    }
    
    // (Balanceamento) Se for um Chefe com Queimadura, torna o ataque mais lento
    if (isBoss && mechanics.canBurn) {
        currentBurnInterval = currentBurnInterval * 1.5; // 50% mais lento
    }
    
    currentEnemy = {
        name: name,
        hp: finalHP,
        maxHp: finalHP,
        goalType: enemyRules.goalType,
        goalValue: enemyRules.goalValue,
        originalText: enemyRules.text,
        targetsToHit: (enemyRules.goalType === 'TARGET_MERGE') ? [...enemyRules.goalValue] : [],
        isBoss: isBoss,
        ...mechanics // Adiciona canDelete, canBlock, canBurn, etc.
    };
    
    if (currentEnemy.goalType === 'TARGET_MERGE') {
        currentEnemy.targetsToHit.forEach(value => {
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
        board[r][c] = -value - 100; // Ex: -116. Diferencia de -1, -2, -3
    }
}
// (updateEnemyUI - sem alterações)
function updateEnemyUI() {
    const hpContainer = document.getElementById("enemy-hp-bar-outer");
    const hpText = document.getElementById("enemy-hp-text");
    const enemyContainer = document.getElementById("enemy-container");
    if (currentEnemy.goalType === 'HP_DAMAGE' || currentEnemy.goalType !== 'HP_FILTERED') {
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
    let conditionText = currentEnemy.originalText;
    if (currentEnemy.goalType === 'TARGET_MERGE') {
        let total = currentEnemy.goalValue.length;
        let remaining = currentEnemy.targetsToHit.length;
        if (remaining < total) {
            conditionText = `${currentEnemy.originalText} (${total - remaining}/${total})`;
        }
    }
    document.getElementById("enemy-condition-text").innerText = conditionText;
}

// (Função de Debug - forceWinLevel)
function forceWinLevel() {
    if (isInputLocked) return;
    
    currentEnemy.hp = 0;
    enemiesDefeated++;
    clearAllTimers();
    isInputLocked = true;
    document.getElementById("enemy-defeated-text").innerText = `DEBUG: Nível Concluído!`;
    document.getElementById("enemy-defeated-overlay").classList.add("visible");
    setTimeout(() => {
        document.getElementById("enemy-defeated-overlay").classList.remove("visible");
        resetLevel(); 
    }, 1000); // Tempo menor para debug
}

// (applyDamage - sem alterações)
function applyDamage(damageValues, targetMerges) {
    if (currentEnemy.hp <= 0) return;
    let totalValidDamage = 0;
    let didResist = false;
    let instantWin = false;
    switch (currentEnemy.goalType) {
        case 'HP_DAMAGE':
            totalValidDamage = damageValues.reduce((a, b) => a + b, 0);
            break;
        case 'HP_FILTERED':
            if (damageValues.length > 0) {
                for (const val of damageValues) {
                    if (currentEnemy.goalValue.includes(val)) {
                        totalValidDamage += val;
                    } else {
                        didResist = true;
                    }
                }
            }
            break;
        case 'MERGE_LIST':
        case 'BUILD_TILE':
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
    updateEnemyUI();
    if (instantWin || currentEnemy.hp <= 0) {
        currentEnemy.hp = 0;
        enemiesDefeated++;
        clearAllTimers();
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
// (updateBoardView - ATUALIZADO com Congelado, Fantasma, Embaralhado)
function updateBoardView(spawnedTiles, mergedTiles, deletedTiles = [], blockedTiles = [], burnedTiles = [], frozenTiles = [], ghostTiles = [], shuffledTiles = [], hitFrozenTiles = []) {
    const spawnedKeys = new Set(spawnedTiles.map(t => `${t.r}-${t.c}`));
    const mergedKeys = new Set(mergedTiles.map(t => `${t.r}-${t.c}`));
    const deletedKeys = new Set(deletedTiles.map(t => `${t.r}-${t.c}`));
    const blockedKeys = new Set(blockedTiles.map(t => `${t.r}-${t.c}`));
    const burnedKeys = new Set(burnedTiles.map(t => `${t.r}-${t.c}`));
    const frozenKeys = new Set(frozenTiles.map(t => `${t.r}-${t.c}`));
    const ghostKeys = new Set(ghostTiles.map(t => `${t.r}-${t.c}`));
    const shuffledKeys = new Set(shuffledTiles.map(t => `${t.r}-${t.c}`));
    const hitFrozenKeys = new Set(hitFrozenTiles.map(t => `${t.r}-${t.c}`)); 

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.getElementById(`grid-cell-${r}-${c}`);
            cell.innerHTML = ""; 
            let value = board[r][c];
            const key = `${r}-${c}`;
            
            if (value > 0) { // Peça Normal
                let tile = document.createElement("div");
                tile.classList.add("tile");
                tile.classList.add("tile-" + value);
                tile.innerText = value;
                if (deletedKeys.has(key)) { tile.classList.add("tile-deleted"); } 
                else if (burnedKeys.has(key)) { tile.classList.add("tile-burned"); }
                else if (shuffledKeys.has(key)) { tile.classList.add("tile-shuffled"); }
                else {
                    if (spawnedKeys.has(key)) tile.classList.add("tile-new");
                    if (mergedKeys.has(key)) tile.classList.add("tile-merged");
                }
                cell.append(tile);
            } else if (value < -100) { // Peça Estática (Alvo)
                let posValue = Math.abs(value + 100); 
                let tile = document.createElement("div");
                tile.classList.add("tile");
                tile.classList.add("tile-static");
                tile.classList.add("tile-static-" + posValue);
                tile.innerText = posValue;
                cell.append(tile);
            } else if (value === -1) { // Peça Bloqueada
                let tile = document.createElement("div");
                tile.classList.add("tile");
                tile.classList.add("tile-blocked-style"); 
                if (blockedKeys.has(key)) {
                    tile.classList.add("tile-blocked");
                }
                cell.append(tile);
            } else if (value === -2) { // Peça Congelada
                let tile = document.createElement("div");
                tile.classList.add("tile");
                tile.classList.add("tile-frozen-style");
                let frozenData = frozenSlots.find(s => s.r === r && s.c === c);
                if (frozenData) {
                    tile.innerText = frozenData.value;
                }
                
                if (hitFrozenKeys.has(key)) {
                    tile.classList.add("tile-frozen-hit");
                }
                if (frozenKeys.has(key)) tile.classList.add("tile-frozen-new");
                if (shuffledKeys.has(key)) tile.classList.add("tile-shuffled");
                cell.append(tile);
            } else if (value === -3) { // Peça Fantasma
                let tile = document.createElement("div");
                tile.classList.add("tile");
                tile.classList.add("tile-ghost-style");
                let ghostData = ghostSlots.find(s => s.r === r && s.c === c);
                if (ghostData) tile.innerText = ghostData.value;
                if (ghostKeys.has(key)) tile.classList.add("tile-ghost-new");
                if (shuffledKeys.has(key)) tile.classList.add("tile-shuffled");
                cell.append(tile);
            }
        }
    }
}
// (spawnNumber - sem alterações)
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

// --- LÓGICA DE MOVIMENTO ---
// (processMove - ATUALIZADO)
function processMove(slideResult, isFastMove) {
    let { hasChanged, mergedTiles, totalDamageValues, targetMerges, hitFrozenTiles } = slideResult;
    let deletionsToApply = 0;
    
    if (hasChanged || hitFrozenTiles.length > 0) {
        if (isFastMove) {
            deletionsToApply++;
        }
        
        // Punição por Não-Soma
        if (totalDamageValues.length === 0 && targetMerges.length === 0 && hitFrozenTiles.length === 0) {
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
        updateBoardView([], mergedTiles, [], [], [], [], [], [], hitFrozenTiles);
        
        if (currentEnemy.hp > 0) {
            if (deletionsToApply > 0) {
                applyPunishmentDeletions(deletionsToApply, null);
            }
            // Só spawna novo número se o movimento não foi apenas quebrar gelo
            if (hasChanged) {
                setTimeout(() => {
                    const spawnedTile = spawnNumber();
                    updateBoardView(spawnedTile ? [spawnedTile] : [], [], [], [], [], [], []);
                    checkWin();
                    checkGameOver();
                }, 100); 
            }
        }
    } else {
        scoreDisplay.innerText = 0;
    }
}
// (handleKeyInput - sem alterações)
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
    if (slideResult.hasChanged || slideResult.hitFrozenTiles.length > 0) {
        board = slideResult.board;
    }
    processMove(slideResult, isFastMove);
}
// (handleTouchStart, handleTouchEnd, handleSwipe - sem alterações)
let touchStartX = 0;
let touchStartY = 0;
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
        if (slideResult.hasChanged || slideResult.hitFrozenTiles.length > 0) {
            board = slideResult.board;
        }
        processMove(slideResult, isFastMove);
    }
}
// (boardHasTile - sem alterações)
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

// --- Funções de Slide (ATUALIZADAS) ---

// (slide - ATUALIZADO com Congelado e Fantasma)
function slide(row) {
    let newRow = new Array(cols).fill(0);
    let mergedIndices = [];
    let moveDamageValues = [];
    let targetMerges = [];
    let start = 0;

    for (let i = 0; i <= cols; i++) {
        // Parede = -1 (Bloqueio) ou -2 (Congelado)
        if (i === cols || row[i] === -1 || row[i] === -2) {
            let segment = row.slice(start, i);
            if (segment.length === 0) { 
                if (i < cols) newRow[i] = row[i]; // Preserva -1 ou -2
                start = i + 1;
                continue;
            }

            // -3 (Fantasma) é tratado como espaço vazio para merge
            let filteredSegment = segment.filter(num => num !== 0 && num !== -3); 
            let originalMergedIndices = [];
            
            for (let j = 0; j < filteredSegment.length - 1; j++) {
                let current = filteredSegment[j];
                let next = filteredSegment[j+1];
                if (current > 0 && current === next) { // Merge Normal
                    filteredSegment[j] *= 2;
                    moveDamageValues.push(filteredSegment[j]);
                    filteredSegment[j+1] = 0;
                    originalMergedIndices.push(j);
                } 
                else if (current > 0 && next < -100 && current === Math.abs(next + 100)) { // Merge Alvo
                    filteredSegment[j] = 0;
                    filteredSegment[j+1] = 0;
                    targetMerges.push(current);
                }
                else if (current < -100 && next > 0 && Math.abs(current + 100) === next) { // Merge Alvo
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
            
            // Remonta o segmento, pulando os slots de fantasma
            let tileIdx = 0;
            for (let j = start; j < i; j++) {
                if (row[j] === -3) { // Se o slot original era fantasma, mantém
                    newRow[j] = -3;
                    continue; 
                }
                if (tileIdx < slidSegment.length) {
                    newRow[j] = slidSegment[tileIdx];
                    if (slidMergedIndices.includes(tileIdx)) {
                        mergedIndices.push(j);
                    }
                    tileIdx++;
                }
            }
            
            if (i < cols) { newRow[i] = row[i]; } // Preserva -1 ou -2
            start = i + 1;
        }
    }
    return { newRow, mergedIndices, moveDamageValues, targetMerges };
}

// (slideLeft - ATUALIZADO com Congelado)
function slideLeft(inputBoard) {
    let newBoard = JSON.parse(JSON.stringify(inputBoard));
    let hasChanged = false, mergedTiles = [], totalDamageValues = [], totalTargetMerges = [];
    let hitFrozenTiles = [];

    // 1. Processar "batidas" em peças congeladas
    for (let r = 0; r < rows; r++) {
        for (let c = 1; c < cols; c++) {
            // Se [c] está congelado E [c-1] é uma peça normal
            if (newBoard[r][c] === -2 && newBoard[r][c-1] > 0) {
                let attackerValue = newBoard[r][c-1];
                let frozen = frozenSlots.find(f => f.r === r && f.c === c);
                
                if (frozen && attackerValue >= frozen.value) { // Condição: Peça >= Peça Congelada
                    newBoard[r][c-1] = 0; // Atacante é destruído
                    frozen.hits--;
                    hitFrozenTiles.push({r: r, c: c});
                    hasChanged = true;
                    if (frozen.hits <= 0) {
                        newBoard[r][c] = frozen.value; // Descongela
                        frozenSlots = frozenSlots.filter(f => f.r !== r || f.c !== c);
                    }
                }
            }
        }
    }

    // 2. Processar slides normais
    for (let r = 0; r < rows; r++) {
        let row = newBoard[r];
        let { newRow, mergedIndices, moveDamageValues, targetMerges } = slide(row);
        if (JSON.stringify(row) !== JSON.stringify(newRow)) {
            hasChanged = true;
        }
        newBoard[r] = newRow;
        totalDamageValues.push(...moveDamageValues);
        totalTargetMerges.push(...targetMerges);
        for (let c of mergedIndices) mergedTiles.push({r: r, c: c});
    }
    
    return { board: newBoard, hasChanged, mergedTiles, totalDamageValues, targetMerges: totalTargetMerges, hitFrozenTiles };
}
// (slideRight - ATUALIZADO com Congelado)
function slideRight(inputBoard) {
    let newBoard = JSON.parse(JSON.stringify(inputBoard));
    let hasChanged = false, mergedTiles = [], totalDamageValues = [], totalTargetMerges = [];
    let hitFrozenTiles = [];

    // 1. Processar "batidas"
    for (let r = 0; r < rows; r++) {
        for (let c = cols - 2; c >= 0; c--) {
            // Se [c] está congelado E [c+1] é uma peça normal
            if (newBoard[r][c] === -2 && newBoard[r][c+1] > 0) {
                let attackerValue = newBoard[r][c+1];
                let frozen = frozenSlots.find(f => f.r === r && f.c === c);
                
                if (frozen && attackerValue >= frozen.value) {
                    newBoard[r][c+1] = 0; // Atacante destruído
                    frozen.hits--;
                    hitFrozenTiles.push({r: r, c: c});
                    hasChanged = true;
                    if (frozen.hits <= 0) {
                        newBoard[r][c] = frozen.value;
                        frozenSlots = frozenSlots.filter(f => f.r !== r || f.c !== c);
                    }
                }
            }
        }
    }
    
    // 2. Processar slides
    for (let r = 0; r < rows; r++) {
        let row = newBoard[r];
        let reversedRow = row.reverse();
        let { newRow: newReversedRow, mergedIndices: reversedMergedIndices, moveDamageValues, targetMerges } = slide(reversedRow);
        totalDamageValues.push(...moveDamageValues); 
        totalTargetMerges.push(...targetMerges);
        let newRow = newReversedRow.reverse();
        if (JSON.stringify(row) !== JSON.stringify(newRow)) {
            hasChanged = true;
        }
        newBoard[r] = newRow;
        for (let c_rev of reversedMergedIndices) mergedTiles.push({r: r, c: cols - 1 - c_rev});
    }
    
    return { board: newBoard, hasChanged, mergedTiles, totalDamageValues, targetMerges: totalTargetMerges, hitFrozenTiles };
}
// (slideUp - ATUALIZADO com Congelado)
function slideUp(inputBoard) {
    let newBoard = JSON.parse(JSON.stringify(inputBoard));
    let hasChanged = false, mergedTiles = [], totalDamageValues = [], totalTargetMerges = [];
    let hitFrozenTiles = [];

    // 1. Processar "batidas"
    for (let c = 0; c < cols; c++) {
        for (let r = 1; r < rows; r++) {
            // Se [r][c] está congelado E [r-1][c] é uma peça normal
            if (newBoard[r][c] === -2 && newBoard[r-1][c] > 0) {
                let attackerValue = newBoard[r-1][c];
                let frozen = frozenSlots.find(f => f.r === r && f.c === c);
                
                if (frozen && attackerValue >= frozen.value) {
                    newBoard[r-1][c] = 0;
                    frozen.hits--;
                    hitFrozenTiles.push({r: r, c: c});
                    hasChanged = true;
                    if (frozen.hits <= 0) {
                        newBoard[r][c] = frozen.value;
                        frozenSlots = frozenSlots.filter(f => f.r !== r || f.c !== c);
                    }
                }
            }
        }
    }
    
    // 2. Processar slides
    for (let c = 0; c < cols; c++) {
        let column = [];
        for (let r = 0; r < rows; r++) column.push(newBoard[r][c]);
        let { newRow: newColumn, mergedIndices, moveDamageValues, targetMerges } = slide(column);
        totalDamageValues.push(...moveDamageValues);
        totalTargetMerges.push(...targetMerges);
        for (let r_idx of mergedIndices) mergedTiles.push({r: r_idx, c: c});
        for (let r = 0; r < rows; r++) {
            if (newBoard[r][c] !== newColumn[r]) hasChanged = true;
            newBoard[r][c] = newColumn[r];
        }
    }
    
    return { board: newBoard, hasChanged, mergedTiles, totalDamageValues, targetMerges: totalTargetMerges, hitFrozenTiles };
}
// (slideDown - ATUALIZADO com Congelado)
function slideDown(inputBoard) {
    let newBoard = JSON.parse(JSON.stringify(inputBoard));
    let hasChanged = false, mergedTiles = [], totalDamageValues = [], totalTargetMerges = [];
    let hitFrozenTiles = [];

    // 1. Processar "batidas"
    for (let c = 0; c < cols; c++) {
        for (let r = rows - 2; r >= 0; r--) {
            // Se [r][c] está congelado E [r+1][c] é uma peça normal
            if (newBoard[r][c] === -2 && newBoard[r+1][c] > 0) {
                let attackerValue = newBoard[r+1][c];
                let frozen = frozenSlots.find(f => f.r === r && f.c === c);
                
                if (frozen && attackerValue >= frozen.value) {
                    newBoard[r+1][c] = 0;
                    frozen.hits--;
                    hitFrozenTiles.push({r: r, c: c});
                    hasChanged = true;
                    if (frozen.hits <= 0) {
                        newBoard[r][c] = frozen.value;
                        frozenSlots = frozenSlots.filter(f => f.r !== r || f.c !== c);
                    }
                }
            }
        }
    }
    
    // 2. Processar slides
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
            if (newBoard[r][c] !== newColumn[r]) hasChanged = true;
            newBoard[r][c] = newColumn[r];
        }
    }
    
    return { board: newBoard, hasChanged, mergedTiles, totalDamageValues, targetMerges: totalTargetMerges, hitFrozenTiles };
}

// --- VERIFICAÇÃO DE FIM DE JOGO ---
function showGameOverOverlay(message) {
    document.getElementById("game-over-text").innerText = message;
    let overlay = document.getElementById("game-over-overlay");
    overlay.classList.remove("hidden");
    overlay.classList.add("visible");
    clearAllTimers();
    isGamePaused = true;
    checkAndSaveHighScore();
}

function hasValidMoves() {
    // 1. Verifica célula vazia
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] === 0) {
                return true; // Movimento possível
            }
        }
    }

    // 2. Verifica merges adjacentes
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
            let curr = board[r][c];
            let next = board[r][c+1];
            if (curr > 0 && curr === next) return true; // Merge normal
            if (curr > 0 && next < -100 && curr === Math.abs(next + 100)) return true; // Merge alvo
            if (curr < -100 && next > 0 && Math.abs(curr + 100) === next) return true; // Merge alvo
        }
    }
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows - 1; r++) {
            let curr = board[r][c];
            let next = board[r+1][c];
            if (curr > 0 && curr === next) return true;
            if (curr > 0 && next < -100 && curr === Math.abs(next + 100)) return true;
            if (curr < -100 && next > 0 && Math.abs(curr + 100) === next) return true;
        }
    }

    // 3. Verifica "batidas" em congelados
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] === -2) {
                let frozen = frozenSlots.find(f => f.r === r && f.c === c);
                if (!frozen) continue;
                
                // Verifica vizinhos
                if (r > 0 && board[r-1][c] > 0 && board[r-1][c] >= frozen.value) return true;
                if (r < rows - 1 && board[r+1][c] > 0 && board[r+1][c] >= frozen.value) return true;
                if (c > 0 && board[r][c-1] > 0 && board[r][c-1] >= frozen.value) return true;
                if (c < cols - 1 && board[r][c+1] > 0 && board[r][c+1] >= frozen.value) return true;
            }
        }
    }
    
    // 4. Verifica se há fantasmas (espaços vazios)
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] === -3) {
                return true; // Fantasma conta como espaço vazio
            }
        }
    }

    return false; // Sem movimentos
}

function checkGameOver() {
    if (gameWon || document.getElementById("game-over-overlay").classList.contains("visible")) { 
        return; 
    }
    
    // Verifica se há peças jogáveis
    let hasTiles = false;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) { if (board[r][c] > 0) { hasTiles = true; break; } }
        if (hasTiles) break;
    }
    if (!hasTiles) { showGameOverOverlay("Você não tem mais peças!"); return; }

    // Verifica se há movimentos válidos (merge, espaço vazio, bater no gelo)
    if (!hasValidMoves()) {
        showGameOverOverlay("Sem movimentos!");
    }
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