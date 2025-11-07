// game.js
const HIGH_SCORE_KEY = "rpg2048-highScore";
const THEME_KEY = "rpg2048-theme"; // NOVO

// NOVO: Variáveis para o tema
let themeToggle;
let bodyElement;

window.onload = function() {
    restartGame(); 
    document.getElementById("restart-btn").addEventListener("click", restartGame);
    
    // NOVO: Lógica do Tema
    themeToggle = document.getElementById("theme-toggle");
    bodyElement = document.body;
    themeToggle.addEventListener("change", toggleTheme);
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
const BLOCK_DURATION = 3000;
let currentBlockInterval;
let currentDeleteMin;
let currentDeleteMax;
let blockedSlots = [];
let maxBlocks = 1;
let isInputLocked = false;
const FAST_MOVE_THRESHOLD = 200;
let lastMoveTimestamp = 0;
let noMergeStreak = 0;


// --- NOVO: Funções de Tema ---
function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    applyTheme(savedTheme || 'light'); // Padrão é 'light'
}

function applyTheme(theme) {
    if (theme === 'dark') {
        bodyElement.classList.add("dark-theme");
        themeToggle.checked = true;
    } else {
        bodyElement.classList.remove("dark-theme");
        themeToggle.checked = false;
    }
    // Guarda a preferência
    localStorage.setItem(THEME_KEY, theme);
    
    // NOVO: Atualiza a cor do tema do PWA
    // (Isto muda a cor da barra de status no telemóvel)
    const newThemeColor = (theme === 'dark') ? '#424242' : '#bbada0';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', newThemeColor);
}

function toggleTheme() {
    applyTheme(themeToggle.checked ? 'dark' : 'light');
}
// --- FIM Funções de Tema ---


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

// ... (O resto do seu game.js, de clearBlockTimer() até o final, 
//      permanece exatamente o mesmo da última vez) ...

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
    if (isInputLocked || blockedSlots.length >= maxBlocks) return; 
    let availableSlots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] >= 0) availableSlots.push({r, c});
    if (availableSlots.length === 0) return;
    let {r, c} = availableSlots[Math.floor(Math.random() * availableSlots.length)];
    const newBlockedSlot = { r, c, value: board[r][c] };
    blockedSlots.push(newBlockedSlot);
    board[r][c] = -1;
    updateBoardView([], [], [], [newBlockedSlot]); 
    setTimeout(() => unblockSlot(newBlockedSlot), BLOCK_DURATION);
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
function applyPunishmentDeletions(count, onCompleteCallback) {
    if (isInputLocked || currentEnemy.hp <= 0 || count <= 0) {
        if (onCompleteCallback) onCompleteCallback();
        return;
    }
    isInputLocked = true;
    let tilesToDelete = [];
    let tempBoard = JSON.parse(JSON.stringify(board)); 
    for (let i = 0; i < count; i++) {
        let buckets = { low: [], mid: [], high: [], epic: [] };
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const val = tempBoard[r][c];
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
        if (rand < 0.90) { // 90%
            chosenBucket = buckets.low;
        } else if (rand < 0.95) { // 5%
            chosenBucket = buckets.mid;
        } else if (rand < 0.98) { // 3%
            chosenBucket = buckets.high;
        } else { // 2%
            chosenBucket = buckets.epic;
        }
        if (chosenBucket.length === 0) {
            if (buckets.low.length > 0) chosenBucket = buckets.low;
            else if (buckets.mid.length > 0) chosenBucket = buckets.mid;
            else if (buckets.high.length > 0) chosenBucket = buckets.high;
            else if (buckets.epic.length > 0) chosenBucket = buckets.epic;
            else break;
        }
        let tileToPick = chosenBucket[Math.floor(Math.random() * chosenBucket.length)];
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
    const speedFactor = Math.pow(0.95, enemiesDefeated);
    maxBlocks = Math.min(3, 1 + Math.floor(enemiesDefeated / 4));
    currentBlockInterval = Math.max(2000, BLOCK_INTERVAL_START * speedFactor);
    currentDeleteMin = Math.max(10000, DELETE_DELAY_MIN_START * speedFactor);
    currentDeleteMax = Math.max(15000, DELETE_DELAY_MAX_START * speedFactor);
    document.getElementById("game-over-overlay").classList.remove("visible");
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
function spawnNewEnemy() {
    let name = `Inimigo Nível ${enemiesDefeated + 1}`;
    let hp = Math.floor(100 * Math.pow(1.2, enemiesDefeated));
    let enemyRules = {};
    const goalTypeIndex = enemiesDefeated % 3; 
    enemyRules = { 
        hp: hp, 
        goalType: 'HP_MERGE',
        goalValue: null,
        text: "Condição: Nenhuma" 
    };
    if (enemiesDefeated === 2) {
        enemyRules = { hp: 150, goalType: 'HP_MERGE', goalValue: [4, 8], text: "Dano: Apenas 4 ou 8" };
    } else if (enemiesDefeated === 3) {
        enemyRules = { hp: 1, goalType: 'BUILD_TILE', goalValue: [128], text: "Condição: Crie um 128" };
    } else if (enemiesDefeated === 4) {
        enemyRules = { hp: 1, goalType: 'TARGET_MERGE', goalValue: [16], text: "Condição: Combine com o 16" };
    } else if (enemiesDefeated === 5) {
        enemyRules = { hp: 220, goalType: 'HP_MERGE', goalValue: [16, 32], text: "Dano: Apenas 16 ou 32" };
    } else if (enemiesDefeated === 6) {
        enemyRules = { hp: 1, goalType: 'BUILD_TILE', goalValue: [256], text: "Condição: Crie um 256" };
    } else if (enemiesDefeated === 7) {
        enemyRules = { hp: 1, goalType: 'TARGET_MERGE', goalValue: [32, 64], text: "Condição: Combine com o 32 ou 64" };
    } else if (enemiesDefeated >= 8) {
        switch (goalTypeIndex) {
            case 0:
                enemyRules = { hp: hp, goalType: 'HP_MERGE', goalValue: [32, 64, 128], text: "Dano: 32, 64 ou 128" };
                break;
            case 1:
                enemyRules = { hp: 1, goalType: 'BUILD_TILE', goalValue: [512], text: "Condição: Crie um 512" };
                break;
            case 2:
                enemyRules = { hp: 1, goalType: 'TARGET_MERGE', goalValue: [64], text: "Condição: Combine com o 64" };
                break;
        }
    }
    currentEnemy = {
        name: name,
        hp: enemyRules.hp,
        maxHp: enemyRules.hp,
        goalType: enemyRules.goalType,
        goalValue: enemyRules.goalValue,
        conditionText: enemyRules.text
    };
    if (currentEnemy.goalType === 'TARGET_MERGE') {
        currentEnemy.goalValue.forEach(value => {
            placeStaticTile(value);
        });
    }
    document.getElementById("enemy-name").innerText = currentEnemy.name;
}
function placeStaticTile(value) {
    let emptyCells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] === 0) {
                emptyCells.push({r, c});
            }
        }
    }
    if (emptyCells.length > 0) {
        let {r, c} = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        board[r][c] = -value; 
    }
}
function updateEnemyUI() {
    const hpPercent = (currentEnemy.hp / currentEnemy.maxHp) * 100;
    document.getElementById("enemy-hp-bar-inner").style.width = `${Math.max(hpPercent, 0)}%`;
    document.getElementById("enemy-hp-text").innerText = `${Math.max(currentEnemy.hp, 0)} / ${currentEnemy.maxHp}`;
    document.getElementById("enemy-condition-text").innerText = currentEnemy.conditionText;
}
function applyDamage(damageValues, targetMerges) {
    if (currentEnemy.hp <= 0) return;
    let totalValidDamage = 0;
    let didResist = false;
    let instantWin = false;
    switch (currentEnemy.goalType) {
        case 'HP_MERGE':
        case 'BUILD_TILE':
            if (damageValues.length > 0) {
                for (const val of damageValues) {
                    if (currentEnemy.goalValue === null || currentEnemy.goalValue.includes(val)) {
                        if (currentEnemy.goalType === 'BUILD_TILE') {
                            instantWin = true;
                        } else {
                            totalValidDamage += val;
                        }
                    } else {
                        didResist = true;
                    }
                }
            }
            break;
        case 'TARGET_MERGE':
            if (targetMerges.length > 0) {
                for (const val of targetMerges) {
                    if (currentEnemy.goalValue.includes(val)) {
                        instantWin = true;
                        break;
                    }
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
        updateEnemyUI();
    }
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

// --- LÓGICA DE MOVIMENTO ---
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
    if (isInputLocked || currentEnemy.hp <= 0 || document.getElementById("game-over-overlay").classList.contains("visible") || gameWon) {
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
    if (isInputLocked) return;
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

// --- Funções de Slide ---
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
    checkAndSaveHighScore();
}
function checkGameOver() {
    if (gameWon || document.getElementById("game-over-overlay").classList.contains("visible")) { return; }
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
function checkWin() {
    if (gameWon) return;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] === 2048) { alert("Você Venceu! (o 2048)"); gameWon = true; }
        }
    }
}