// game.js
window.onload = function() {
    restartGame(); 
    document.getElementById("restart-btn").addEventListener("click", restartGame);
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
        if (rand < 0.70) { chosenBucket = buckets.low; }
        else if (rand < 0.85) { chosenBucket = buckets.mid; }
        else if (rand < 0.95) { chosenBucket = buckets.high; }
        else { chosenBucket = buckets.epic; }
        
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
// (spawnNewEnemy - sem alterações)
function spawnNewEnemy() {
    let name = `Inimigo Nível ${enemiesDefeated + 1}`;
    let hp = Math.floor(100 * Math.pow(1.2, enemiesDefeated));
    let enemyRules = {};
    switch (enemiesDefeated) {
        case 0: case 1:
            enemyRules = { hp: hp, merges: null, text: "Condição: Nenhuma" }; break;
        case 2:
            enemyRules = { hp: 150, merges: [4, 8], text: "Dano: Apenas 4 ou 8" }; break;
        case 3:
            enemyRules = { hp: 180, merges: [16], text: "Dano: Apenas 16" }; break;
        case 4: case 5:
            enemyRules = { hp: 220, merges: [16, 32], text: "Dano: Apenas 16 ou 32" }; break;
        case 6:
            enemyRules = { hp: 300, merges: [32], text: "Dano: Apenas 32" }; break;
        case 7:
            enemyRules = { hp: 330, merges: [64, 128], text: "Dano: Apenas 64 ou 128" }; break;
        case 8:
            enemyRules = { hp: 450, merges: [64], text: "Dano: Apenas 64" }; break;
        case 9:
            enemyRules = { hp: 500, merges: [32, 64], text: "Dano: Apenas 32 ou 64" }; break;
        case 10:
            enemyRules = { hp: 800, merges: [128], text: "Dano: Apenas 128" }; break;
        default:
            enemyRules = { hp: hp, merges: [32, 64, 128], text: "Dano: 32, 64 ou 128" }; break;
    }
    currentEnemy = { name: name, hp: enemyRules.hp, maxHp: enemyRules.hp, allowedMerges: enemyRules.merges, conditionText: enemyRules.text };
    document.getElementById("enemy-name").innerText = currentEnemy.name;
}
// (updateEnemyUI - sem alterações)
function updateEnemyUI() {
    const hpPercent = (currentEnemy.hp / currentEnemy.maxHp) * 100;
    document.getElementById("enemy-hp-bar-inner").style.width = `${Math.max(hpPercent, 0)}%`;
    document.getElementById("enemy-hp-text").innerText = `${Math.max(currentEnemy.hp, 0)} / ${currentEnemy.maxHp}`;
    document.getElementById("enemy-condition-text").innerText = currentEnemy.conditionText;
}
// (applyDamage - sem alterações)
function applyDamage(damageValues) {
    if (damageValues.length === 0 || currentEnemy.hp <= 0) { return; }
    let totalMoveDamage = 0, totalValidDamage = 0;
    for (const val of damageValues) {
        totalMoveDamage += val;
        if (currentEnemy.allowedMerges === null || currentEnemy.allowedMerges.includes(val)) {
            totalValidDamage += val;
        }
    }
    let conditionTextElement = document.getElementById("enemy-condition-text");
    if (totalMoveDamage > totalValidDamage && totalMoveDamage > 0) {
        conditionTextElement.classList.add("condition-shake");
        setTimeout(() => { conditionTextElement.classList.remove("condition-shake"); }, 400);
    } else {
        conditionTextElement.classList.remove("condition-shake");
    }
    scoreDisplay.innerText = totalValidDamage;
    if (totalValidDamage > 0) {
        currentEnemy.hp -= totalValidDamage;
        updateEnemyUI();
        if (currentEnemy.hp <= 0) {
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
}

// --- LÓGICA DO 2048 ---
// (updateBoardView - sem alterações)
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
// (processMove - sem alterações)
function processMove(slideResult, isFastMove) {
    let { hasChanged, mergedTiles, totalDamageValues } = slideResult;
    let deletionsToApply = 0;
    if (hasChanged) {
        if (isFastMove) {
            deletionsToApply++;
        }
        if (totalDamageValues.length > 0) {
            noMergeStreak = 0;
        } else {
            if (boardHasTile(16)) {
                noMergeStreak++;
                if (noMergeStreak >= 3) {
                    deletionsToApply++;
                    noMergeStreak = 0;
                }
            }
        }
        applyDamage(totalDamageValues);
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

// ALTERADO: Lógica de input refatorada
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
    
    // 1. Simula o movimento
    let slideResult = slideFn(board); // Passa o 'board' global
    
    // 2. Se for válido, atualiza o 'board' global
    if (slideResult.hasChanged) {
        board = slideResult.board;
    }
    
    // 3. Processa o resultado
    processMove(slideResult, isFastMove);
}

// --- CONTROLE DE TOQUE ---
function handleTouchStart(e) {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}
// ALTERADO: Lógica de input refatorada
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
// ALTERADO: Lógica de input refatorada
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
        // 1. Simula o movimento
        let slideResult = slideFn(board);
        
        // 2. Se for válido, atualiza o 'board' global
        if (slideResult.hasChanged) {
            board = slideResult.board;
        }
        
        // 3. Processa o resultado
        processMove(slideResult, isFastMove);
    }
}

// --- Funções de Slide (ALTERADAS) ---
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

// (slide - sem alterações)
function slide(row) {
    let newRow = new Array(cols).fill(0);
    let mergedIndices = [];
    let moveDamageValues = [];
    let start = 0;
    for (let i = 0; i <= cols; i++) {
        if (i === cols || row[i] === -1) {
            let segment = row.slice(start, i);
            let segmentLength = segment.length;
            if (segmentLength === 0) { 
                if (i < cols) newRow[i] = -1;
                start = i + 1;
                continue;
            }
            let filteredSegment = segment.filter(num => num > 0);
            let originalMergedIndices = [];
            for (let j = 0; j < filteredSegment.length - 1; j++) {
                if (filteredSegment[j] === filteredSegment[j+1]) {
                    filteredSegment[j] *= 2;
                    moveDamageValues.push(filteredSegment[j]);
                    filteredSegment[j+1] = 0;
                    originalMergedIndices.push(j);
                }
            }
            let slidSegment = filteredSegment.filter(num => num > 0);
            let slidMergedIndices = [];
            let mergeIdx = 0;
            for(let k=0; k < slidSegment.length; k++) {
                while(mergeIdx < originalMergedIndices.length && filteredSegment.slice(0, originalMergedIndices[mergeIdx]+1).filter(n => n > 0).length <= k) mergeIdx++;
                if (mergeIdx < originalMergedIndices.length && filteredSegment.slice(0, originalMergedIndices[mergeIdx]+1).filter(n => n > 0).length === k + 1) slidMergedIndices.push(k);
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
    return { newRow, mergedIndices, moveDamageValues };
}

// ALTERADO: Funções de slide agora são "puras" (recebem 'inputBoard')
function slideLeft(inputBoard) {
    let newBoard = JSON.parse(JSON.stringify(inputBoard)); // Cópia
    let hasChanged = false, mergedTiles = [], totalDamageValues = []; 
    
    for (let r = 0; r < rows; r++) {
        let row = newBoard[r]; // Pega da cópia
        let { newRow, mergedIndices, moveDamageValues } = slide(row);
        newBoard[r] = newRow; // Modifica a cópia
        totalDamageValues.push(...moveDamageValues);
        for (let c of mergedIndices) mergedTiles.push({r: r, c: c});
    }
    
    hasChanged = JSON.stringify(newBoard) !== JSON.stringify(inputBoard);
    return { board: newBoard, hasChanged, mergedTiles, totalDamageValues };
}
function slideRight(inputBoard) {
    let newBoard = JSON.parse(JSON.stringify(inputBoard)); // Cópia
    let hasChanged = false, mergedTiles = [], totalDamageValues = [];
    
    for (let r = 0; r < rows; r++) {
        let row = newBoard[r]; // Pega da cópia
        let reversedRow = row.reverse();
        let { newRow: newReversedRow, mergedIndices: reversedMergedIndices, moveDamageValues } = slide(reversedRow);
        totalDamageValues.push(...moveDamageValues); 
        let newRow = newReversedRow.reverse();
        newBoard[r] = newRow; // Modifica a cópia
        for (let c_rev of reversedMergedIndices) mergedTiles.push({r: r, c: cols - 1 - c_rev});
    }
    
    hasChanged = JSON.stringify(newBoard) !== JSON.stringify(inputBoard);
    return { board: newBoard, hasChanged, mergedTiles, totalDamageValues };
}
function slideUp(inputBoard) {
    let newBoard = JSON.parse(JSON.stringify(inputBoard)); // Cópia
    let hasChanged = false, mergedTiles = [], totalDamageValues = [];
    
    for (let c = 0; c < cols; c++) {
        let column = [];
        for (let r = 0; r < rows; r++) column.push(newBoard[r][c]); // Lê da cópia
        
        let { newRow: newColumn, mergedIndices, moveDamageValues } = slide(column);
        totalDamageValues.push(...moveDamageValues);
        
        for (let r_idx of mergedIndices) mergedTiles.push({r: r_idx, c: c});
        for (let r = 0; r < rows; r++) {
            newBoard[r][c] = newColumn[r]; // Modifica a cópia
        }
    }
    
    hasChanged = JSON.stringify(newBoard) !== JSON.stringify(inputBoard);
    return { board: newBoard, hasChanged, mergedTiles, totalDamageValues };
}
function slideDown(inputBoard) {
    let newBoard = JSON.parse(JSON.stringify(inputBoard)); // Cópia
    let hasChanged = false, mergedTiles = [], totalDamageValues = [];
    
    for (let c = 0; c < cols; c++) {
        let column = [];
        for (let r = 0; r < rows; r++) column.push(newBoard[r][c]); // Lê da cópia
        
        let reversedColumn = column.reverse();
        let { newRow: newReversedColumn, mergedIndices: reversedMergedIndices, moveDamageValues } = slide(reversedColumn);
        totalDamageValues.push(...moveDamageValues); 
        let newColumn = newReversedColumn.reverse();
        
        for (let r_rev of reversedMergedIndices) mergedTiles.push({r: rows - 1 - r_rev, c: c});
        for (let r = 0; r < rows; r++) {
            newBoard[r][c] = newColumn[r]; // Modifica a cópia
        }
    }
    
    hasChanged = JSON.stringify(newBoard) !== JSON.stringify(inputBoard);
    return { board: newBoard, hasChanged, mergedTiles, totalDamageValues };
}

// --- VERIFICAÇÃO DE FIM DE JOGO ---
// (showGameOverOverlay, checkGameOver, checkWin - sem alterações)
function showGameOverOverlay(message) {
    document.getElementById("game-over-text").innerText = message;
    let overlay = document.getElementById("game-over-overlay");
    overlay.classList.remove("hidden");
    overlay.classList.add("visible");
    clearBlockTimer();
    clearDeleteTimer();
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
    for (let r = 0; r < rows; r++) { for (let c = 0; c < cols - 1; c++) { if (board[r][c] > 0 && board[r][c] === board[r][c+1]) return; } }
    for (let c = 0; c < cols; c++) { for (let r = 0; r < rows - 1; r++) { if (board[r][c] > 0 && board[r][c] === board[r+1][c]) return; } }
    showGameOverOverlay("Sem movimentos!");
}
function checkWin() {
    if (gameWon) return;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (board[r][c] === 2048) { alert("Você Venceu! (o 2048)"); gameWon = true; }
    }
}