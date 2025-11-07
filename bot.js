// bot.js
// Um bot "inteligente" que entende as condições de vitória.

let botInterval = null;
const BOT_TICK_SPEED = 500; // Meio segundo por tentativa

/**
 * Inicia o loop do bot.
 * Para usar: Abra o console (F12) e digite: startBot()
 */
function startBot() {
    if (botInterval) return;
    console.log("🤖 Bot Inteligente INICIADO! (Velocidade: " + BOT_TICK_SPEED + "ms)");
    botInterval = setInterval(botTick, BOT_TICK_SPEED);
}

/**
 * Para o loop do bot.
 * Para usar: Abra o console (F12) e digite: stopBot()
 */
function stopBot() {
    if (!botInterval) return;
    console.log("🤖 Bot parado!");
    clearInterval(botInterval);
    botInterval = null;
}

/**
 * O "cérebro" do bot, roda a cada 'tick'
 */
function botTick() {
    // 1. Não faz nada se o jogo estiver bloqueado ou acabado
    if (isInputLocked || document.getElementById("game-over-overlay").classList.contains("visible")) {
        return; 
    }

    // 2. Simula todos os 4 movimentos
    // O 'board' global é passado para as funções de simulação "puras"
    const simulations = [
        { dir: 'up', result: slideUp(board) },
        { dir: 'down', result: slideDown(board) },
        { dir: 'left', result: slideLeft(board) },
        { dir: 'right', result: slideRight(board) }
    ];

    // 3. Filtra apenas os movimentos válidos (que mudam o tabuleiro)
    let validMoves = simulations.filter(sim => sim.result.hasChanged);

    if (validMoves.length === 0) {
        console.log("Bot: Não há movimentos válidos. Parando.");
        stopBot();
        return;
    }

    // 4. A "Inteligência": Pontua cada movimento válido
    for (let sim of validMoves) {
        let res = sim.result;
        
        // Pega o 'score' de dano válido (baseado nas regras do inimigo)
        sim.validDamage = calculateValidDamage(res.totalDamageValues, currentEnemy.allowedMerges);
        
        // Pega o 'score' de dano total (qualquer soma)
        sim.totalScore = res.totalDamageValues.reduce((a, b) => a + b, 0);
        
        // Pega o 'score' de espaços vazios (muito importante)
        sim.emptyCells = countEmptyCells(res.board);
    }
    
    // 5. Ordena os movimentos pela melhor heurística
    validMoves.sort((a, b) => {
        // Prioridade 1: Maior dano VÁLIDO (para vencer o inimigo)
        if (a.validDamage !== b.validDamage) {
            return b.validDamage - a.validDamage;
        }
        
        // Prioridade 2: Maior número de espaços vazios (para sobreviver)
        if (a.emptyCells !== b.emptyCells) {
            return b.emptyCells - a.emptyCells;
        }

        // Prioridade 3: Maior pontuação total (para construir peças maiores)
        if (a.totalScore !== b.totalScore) {
            return b.totalScore - a.totalScore;
        }
        
        return 0; // Empate
    });
    
    // 6. O melhor movimento é o primeiro da lista
    let bestMove = validMoves[0];

    // 7. Executa o melhor movimento
    console.log(`Bot move: ${bestMove.dir} (Dano Válido: ${bestMove.validDamage}, Vazios: ${bestMove.emptyCells})`);
    
    // 7a. Atualiza o 'board' global com o resultado da simulação
    board = bestMove.result.board;
    
    // 7b. Processa o movimento (anúncio de dano, spawn de peça, etc.)
    // O 'false' é para 'isFastMove', já que o bot nunca joga rápido
    processMove(bestMove.result, false); 
}


// --- Funções Helper (Apenas para o Bot) ---

/**
 * Calcula o dano válido com base nas regras do inimigo.
 */
function calculateValidDamage(damageValues, allowedMerges) {
    if (damageValues.length === 0) {
        return 0;
    }
    
    let totalValidDamage = 0;
    for (const val of damageValues) {
        if (allowedMerges === null || allowedMerges.includes(val)) {
            totalValidDamage += val;
        }
    }
    return totalValidDamage;
}

/**
 * Conta o número de células vazias (valor 0) num tabuleiro.
 */
function countEmptyCells(boardState) {
    let count = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (boardState[r][c] === 0) {
                count++;
            }
        }
    }
    return count;
}