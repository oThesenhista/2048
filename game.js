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
const BLOCK_INTERVAL = 5000;
const BLOCK_DURATION = 3000;
let blockedSlot = null;
let isInputLocked = false;

// --- NOVO: VARIÁVEIS DE TOQUE ---
let touchStartX = 0;
let touchStartY = 0;

// --- FUNÇÕES DE TIMER DE ATAQUE ---
function clearBlockTimer() { if (blockAttackTimer) { clearInterval(blockAttackTimer); blockAttackTimer = null; } }
function clearDeleteTimer() { if (deleteAttackTimer) { clearTimeout(deleteAttackTimer); deleteAttackTimer = null; } }
function startBlockTimer() { clearBlockTimer(); blockAttackTimer = setInterval(blockSlotAttack, BLOCK_INTERVAL); }
function scheduleDeleteAttack() {
    clearDeleteTimer();
    const delay = Math.random() * (15000 - 5000) + 5000;
    deleteAttackTimer = setTimeout(deletePieceAttack, delay);
}

// --- FUNÇÕES DE ATAQUE ---
function blockSlotAttack() {
    if (isInputLocked || blockedSlot) return; 
    let availableSlots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] >= 0) availableSlots.push({r, c});
    if (availableSlots.length === 0) return;
    let {r, c} = availableSlots[Math.floor(Math.random() * availableSlots.length)];
    blockedSlot = { r, c, value: board[r][c] };
    board[r][c] = -1;
    updateBoardView([], [], [], [{r, c}]); 
    setTimeout(unblockSlot, BLOCK_DURATION);
}
function deletePieceAttack() {
    let availableTiles = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] > 0) availableTiles.push({r, c});
    if (availableTiles.length === 0) {
        scheduleDeleteAttack();
        checkGameOver();
        return;
    }
    isInputLocked = true;
    let {r, c} = availableTiles[Math.floor(Math.random() * availableTiles.length)];
    document.getElementById("game-board").classList.add("shake");
    updateBoardView([], [], [{r, c}], []); 
    setTimeout(() => {
        board[r][c] = 0;
        isInputLocked = false;
        document.getElementById("game-board").classList.remove("shake");
        updateBoardView([], [], [], []);
        scheduleDeleteAttack();
        checkGameOver();
    }, 600);
}
function unblockSlot() {
    if (isInputLocked) { setTimeout(unblockSlot, 100); return; }
    if (!blockedSlot) return;
    const {r, c, value} = blockedSlot;
    if (board[r][c] === -1) board[r][c] = value;
    blockedSlot = null;
    updateBoardView([], [], [], []);
}

// --- LÓGICA PRINCIPAL DO JOGO ---
function restartGame() {
    enemiesDefeated = 0;
    clearBlockTimer();
    clearDeleteTimer();
    resetLevel();
}

// ALTERADO: Adiciona ouvintes de toque
function resetLevel() {
    board = [ [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0] ];
    gameWon = false;
    scoreDisplay.innerText = 0;
    enemiesDisplay.innerText = enemiesDefeated;
    clearBlockTimer();
    clearDeleteTimer();
    blockedSlot = null;
    isInputLocked = false;
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
    
    // Adiciona ouvintes de teclado
    document.removeEventListener("keyup", handleKeyInput); // Renomeado
    document.addEventListener("keyup", handleKeyInput);
    
    // NOVO: Adiciona ouvintes de toque
    gameBoard.removeEventListener('touchstart', handleTouchStart);
    gameBoard.addEventListener('touchstart', handleTouchStart, { passive: false });
    
    gameBoard.removeEventListener('touchend', handleTouchEnd);
    gameBoard.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // Spawna peças e inicia timers
    let spawned1 = spawnNumber();
    let spawned2 = spawnNumber();
    updateBoardView([spawned1, spawned2], [], [], []);
    startBlockTimer();
    scheduleDeleteAttack();
}

// ALTERADO: Adicionadas novas condições de valor único
function spawnNewEnemy() {
    let name = `Inimigo Nível ${enemiesDefeated + 1}`;
    let hp = Math.floor(100 * Math.pow(1.2, enemiesDefeated));
    let enemyRules = {};

    switch (enemiesDefeated) {
        case 0: case 1:
            enemyRules = { hp: hp, merges: null, text: "Condição: Nenhuma" }; break;
        case 2:
            enemyRules = { hp: 150, merges: [4, 8], text: "Dano: Apenas 4 ou 8" }; break;
        case 3: // NOVO: Condição de valor único
            enemyRules = { hp: 180, merges: [16], text: "Dano: Apenas 16" }; break;
        case 4: case 5:
            enemyRules = { hp: 220, merges: [16, 32], text: "Dano: Apenas 16 ou 32" }; break;
        case 6: // NOVO: Condição de valor único
            enemyRules = { hp: 300, merges: [32], text: "Dano: Apenas 32" }; break;
        case 7:
            enemyRules = { hp: 330, merges: [64, 128], text: "Dano: Apenas 64 ou 128" }; break;
        case 8: // NOVO: Condição de valor único
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
function updateEnemyUI() {
    const hpPercent = (currentEnemy.hp / currentEnemy.maxHp) * 100;
    document.getElementById("enemy-hp-bar-inner").style.width = `${Math.max(hpPercent, 0)}%`;
    document.getElementById("enemy-hp-text").innerText = `${Math.max(currentEnemy.hp, 0)} / ${currentEnemy.maxHp}`;
    document.getElementById("enemy-condition-text").innerText = currentEnemy.conditionText;
}
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

// --- NOVO: LÓGICA DE MOVIMENTO REATORADA ---

// NOVO: Função que processa o resultado de um movimento
function processMove(slideResult) {
    let { hasChanged, mergedTiles, totalDamageValues } = slideResult;
    
    if (hasChanged) {
        applyDamage(totalDamageValues);
        updateBoardView([], mergedTiles, [], []);
        if (currentEnemy.hp > 0) {
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

// ALTERADO: Renomeado e agora chama processMove
function handleKeyInput(e) {
    if (isInputLocked || currentEnemy.hp <= 0 || document.getElementById("game-over-overlay").classList.contains("visible") || gameWon) {
        return;
    }
    let slideResult = null;
    switch(e.key) {
        case "ArrowLeft": slideResult = slideLeft(); break;
        case "ArrowRight": slideResult = slideRight(); break;
        case "ArrowUp": slideResult = slideUp(); break;
        case "ArrowDown": slideResult = slideDown(); break;
        default: return;
    }
    processMove(slideResult);
}

// --- NOVO: FUNÇÕES DE CONTROLE DE TOQUE ---
function handleTouchStart(e) {
    e.preventDefault(); // Impede o scroll da página
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}

function handleTouchEnd(e) {
    e.preventDefault();
    if (isInputLocked) return; // Não faz nada se o input estiver travado
    
    let touchEndX = e.changedTouches[0].clientX;
    let touchEndY = e.changedTouches[0].clientY;
    
    handleSwipe(touchEndX, touchEndY);
}

function handleSwipe(endX, endY) {
    let deltaX = endX - touchStartX;
    let deltaY = endY - touchStartY;
    
    let absDeltaX = Math.abs(deltaX);
    let absDeltaY = Math.abs(deltaY);
    
    const minSwipeDistance = 30; // Mínimo de 30px para ser um swipe
    let slideResult = null;

    if (absDeltaX > absDeltaY) {
        // Swipe Horizontal
        if (absDeltaX > minSwipeDistance) {
            if (deltaX < 0) {
                slideResult = slideLeft(); // Esquerda
            } else {
                slideResult = slideRight(); // Direita
            }
        }
    } else {
        // Swipe Vertical
        if (absDeltaY > minSwipeDistance) {
            if (deltaY < 0) {
                slideResult = slideUp(); // Cima
            } else {
                slideResult = slideDown(); // Baixo
            }
        }
    }
    
    if (slideResult) {
        processMove(slideResult);
    }
}

// --- Funções de Slide (sem alterações) ---
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
function slideLeft() {
    let hasChanged = false, mergedTiles = [], totalDamageValues = []; 
    for (let r = 0; r < rows; r++) {
        let row = board[r], originalRowJSON = JSON.stringify(row);
        let { newRow, mergedIndices, moveDamageValues } = slide(row);
        board[r] = newRow; totalDamageValues.push(...moveDamageValues);
        if (JSON.stringify(newRow) !== originalRowJSON) hasChanged = true;
        for (let c of mergedIndices) mergedTiles.push({r: r, c: c});
    }
    return { hasChanged, mergedTiles, totalDamageValues };
}
function slideRight() {
    let hasChanged = false, mergedTiles = [], totalDamageValues = [];
    for (let r = 0; r < rows; r++) {
        let row = board[r], originalRowJSON = JSON.stringify(row);
        let reversedRow = row.reverse();
        let { newRow: newReversedRow, mergedIndices: reversedMergedIndices, moveDamageValues } = slide(reversedRow);
        totalDamageValues.push(...moveDamageValues); let newRow = newReversedRow.reverse(); board[r] = newRow;
        if (JSON.stringify(newRow) !== originalRowJSON) hasChanged = true;
        for (let c_rev of reversedMergedIndices) mergedTiles.push({r: r, c: cols - 1 - c_rev});
    }
    return { hasChanged, mergedTiles, totalDamageValues };
}
function slideUp() {
    let hasChanged = false, mergedTiles = [], totalDamageValues = [];
    for (let c = 0; c < cols; c++) {
        let column = [], originalColumnJSON;
        for (let r = 0; r < rows; r++) column.push(board[r][c]);
        originalColumnJSON = JSON.stringify(column);
        let { newRow: newColumn, mergedIndices, moveDamageValues } = slide(column);
        totalDamageValues.push(...moveDamageValues);
        if (JSON.stringify(newColumn) !== originalColumnJSON) hasChanged = true;
        for (let r_idx of mergedIndices) mergedTiles.push({r: r_idx, c: c});
        for (let r = 0; r < rows; r++) board[r][c] = newColumn[r];
    }
    return { hasChanged, mergedTiles, totalDamageValues };
}
function slideDown() {
    let hasChanged = false, mergedTiles = [], totalDamageValues = [];
    for (let c = 0; c < cols; c++) {
        let column = [], originalColumnJSON;
        for (let r = 0; r < rows; r++) column.push(board[r][c]);
        originalColumnJSON = JSON.stringify(column);
        let reversedColumn = column.reverse();
        let { newRow: newReversedColumn, mergedIndices: reversedMergedIndices, moveDamageValues } = slide(reversedColumn);
        totalDamageValues.push(...moveDamageValues); let newColumn = newReversedColumn.reverse();
        if (JSON.stringify(newColumn) !== originalColumnJSON) hasChanged = true;
        for (let r_rev of reversedMergedIndices) mergedTiles.push({r: rows - 1 - r_rev, c: c});
        for (let r = 0; r < rows; r++) board[r][c] = newColumn[r];
    }
    return { hasChanged, mergedTiles, totalDamageValues };
}

// --- VERIFICAÇÃO DE FIM DE JOGO ---
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