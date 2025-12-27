// CONFIG & STATE
let config = { difficulty: 'medium', digits: 0, memTime: 2, hideTime: 5, totalRounds: 10 };
let state = { round: 1, score: 0, currentNumber: '', isPlaying: false };
let activeTimers = []; // Para limpar timers se cancelar

// DIFFICULTY RANGES
const ranges = {
    easy: [3, 5],
    medium: [5, 7],
    hard: [8, 10],
    epic: [12, 15],
    impossible: [20, 30]
};

// DOM ELEMENTS
const screens = {
    menu: document.getElementById('menu-screen'),
    game: document.getElementById('game-screen'),
    ranking: document.getElementById('ranking-screen')
};
const gameContent = document.getElementById('game-content');

// --- INIT & PERSISTENCE ---

window.onload = function() {
    // Carregar tema
    if(localStorage.getItem('neuroSpeedTheme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        document.getElementById('theme-icon').className = 'fas fa-sun';
    }
    
    // Configurações iniciais da UI
    updateDifficultySettings();

    // Checar progresso salvo
    loadProgress();
};

function saveProgress() {
    const data = {
        config: config,
        state: state
    };
    localStorage.setItem('neuroSpeedProgress', JSON.stringify(data));
}

function loadProgress() {
    const saved = localStorage.getItem('neuroSpeedProgress');
    if (saved) {
        const data = JSON.parse(saved);
        // Só recupera se estava jogando e não acabou
        if (data.state.isPlaying && data.state.round <= data.config.totalRounds) {
            config = data.config;
            state = data.state;
            
            // Restaura UI
            switchScreen('game');
            updateHeaderStats();
            
            // Reinicia a rodada atual
            playRound(); 
        } else {
            clearProgress();
        }
    }
}

function clearProgress() {
    localStorage.removeItem('neuroSpeedProgress');
}

// --- CÁLCULO DE QI AVANÇADO (PROPORCIONAL) ---

function calculatePrecisionIQ(config, score) {
    // 1. Determinar base de dígitos
    let baseDigits = config.digits;
    if (baseDigits === 0) {
        const averages = { 'easy': 4, 'medium': 6, 'hard': 9, 'epic': 13.5, 'impossible': 25 };
        baseDigits = averages[config.difficulty];
    }

    // 2. Fatores de Ponderação
    const digitFactor = Math.pow(baseDigits, 1.4) * 2.5;
    const memFactor = 1 + ((3 - config.memTime) * 0.25);
    const hideFactor = 1 + ((config.hideTime - 5) * 0.05);

    // 3. Potencial Máximo
    const maxPotentialBonus = digitFactor * memFactor * hideFactor;

    // 4. Cálculo Real Proporcional (Score / TotalRounds)
    // Isso garante que jogar 5 rounds ou 50 rounds dê a mesma média de QI se a taxa de acerto for igual
    const performanceRatio = score / config.totalRounds;
    
    // QI Base = 70 + bônus de performance
    let calculatedIQ = 70 + (maxPotentialBonus * performanceRatio);

    // Normalização
    if (calculatedIQ > 185) calculatedIQ = 185; 
    if (calculatedIQ < 70) calculatedIQ = 70;

    // 5. Desvio Padrão
    // Ajustado para ser mais permissivo em sessões longas (cansaço) e rigoroso em curtas
    let roundFactor = Math.max(0, (10 - config.totalRounds) * 0.1); 
    let deviation = Math.max(2, Math.round(15 - (baseDigits / 2) + roundFactor));

    return {
        value: Math.round(calculatedIQ),
        deviation: deviation,
        label: `±${deviation}`
    };
}

// --- CORE FUNCTIONS ---

function switchScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

function clearAllTimers() {
    activeTimers.forEach(t => clearTimeout(t));
    activeTimers = [];
}

function updateDifficultySettings() {
    const diff = document.getElementById('difficulty').value;
    const range = document.getElementById('digits-range');
    const display = document.getElementById('digits-val');
    
    const minVal = ranges[diff][0];
    const maxVal = ranges[diff][1];
    
    // TRUQUE DO SLIDER: O mínimo do input é (minimoReal - 1)
    // Esse valor extra à esquerda serve exclusivamente para o estado "Aleatório"
    range.min = minVal - 1; 
    range.max = maxVal;
    
    // Reset para Aleatório ao mudar dificuldade
    range.value = range.min;
    display.innerText = "Aleatório";
    config.digits = 0;
}

function updateDigitDisplay() {
    const range = document.getElementById('digits-range');
    const display = document.getElementById('digits-val');
    const val = parseInt(range.value);
    const minReal = parseInt(range.min); // O min do input já é o valor "Aleatório"
    
    // Se o valor for o mínimo do slider (que configuramos como min-1 da dificuldade)
    if (val === minReal) {
        display.innerText = "Aleatório";
        config.digits = 0;
    } else {
        display.innerText = val + " números";
        config.digits = val;
    }
}

function generateRandomNumber(length) {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 10);
    }
    return result;
}

function startGame() {
    // Get Config
    config.difficulty = document.getElementById('difficulty').value;
    config.memTime = parseFloat(document.getElementById('mem-time').value);
    config.hideTime = parseInt(document.getElementById('hide-time').value);
    config.totalRounds = parseInt(document.getElementById('rounds-range').value); // Novo input
    
    const range = document.getElementById('digits-range');
    const val = parseInt(range.value);
    
    // Se valor == min, é aleatório
    config.digits = (val === parseInt(range.min)) ? 0 : val;

    // Reset State
    state.round = 1;
    state.score = 0;
    state.isPlaying = true;
    
    saveProgress();
    updateHeaderStats();
    switchScreen('game');
    playRound();
}

function cancelGame() {
    if(confirm("Tem certeza que deseja sair? Seu progresso atual será perdido.")) {
        clearAllTimers();
        state.isPlaying = false;
        clearProgress();
        showMenu();
    }
}

function playRound() {
    clearAllTimers();

    if (state.round > config.totalRounds) {
        endGame();
        return;
    }

    saveProgress();
    updateHeaderStats();

    // 1. Determine length
    let len = config.digits;
    if (len === 0) {
        const min = ranges[config.difficulty][0];
        const max = ranges[config.difficulty][1];
        len = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 2. Generate Number
    state.currentNumber = generateRandomNumber(len);

    // 3. Show Memorize Phase
    showMemorizePhase();
}

function showMemorizePhase() {
    gameContent.innerHTML = `
        <div class="status-text">Memorize!</div>
        <div class="big-number" style="color: var(--primary);">${state.currentNumber}</div>
        <div class="timer-visual" style="border-top-color: var(--primary); animation-duration: ${config.memTime}s"></div>
    `;

    const t = setTimeout(() => {
        showHidePhase();
    }, config.memTime * 1000);
    activeTimers.push(t);
}

function showHidePhase() {
    gameContent.innerHTML = `
        <div class="status-text">Processando / Falando...</div>
        <div class="big-number" style="color: transparent; text-shadow: 0 0 15px rgba(0,0,0,0.1);">???</div>
        <div class="timer-visual" style="border-top-color: var(--accent); animation-duration: ${config.hideTime}s"></div>
    `;

    const t = setTimeout(() => {
        showRevealPhase();
    }, config.hideTime * 1000);
    activeTimers.push(t);
}

function showRevealPhase() {
    gameContent.innerHTML = `
        <div class="status-text">O número era:</div>
        <div class="big-number">${state.currentNumber}</div>
        <p>Você acertou?</p>
        <div class="row-btns">
            <button class="btn btn-danger" onclick="handleResult(false)">Não</button>
            <button class="btn btn-success" onclick="handleResult(true)">Sim, acertei!</button>
        </div>
    `;
}

function handleResult(success) {
    if (success) state.score++;
    state.round++;
    saveProgress();
    playRound();
}

function updateHeaderStats() {
    document.getElementById('round-display').innerText = `Rodada ${Math.min(state.round, config.totalRounds)}/${config.totalRounds}`;
    document.getElementById('score-display').innerText = `Pontos: ${state.score}`;
    
    // Calcula porcentagem baseada no total de rounds configurado
    const pct = ((state.round - 1) / config.totalRounds) * 100;
    document.getElementById('game-progress').style.width = pct + '%';
}

function endGame() {
    clearProgress();
    state.isPlaying = false;
    
    // CORREÇÃO: Forçar barra de progresso a 100% visualmente
    document.getElementById('game-progress').style.width = '100%';

    const result = calculatePrecisionIQ(config, state.score);
    
    let classification = "Média";
    if (result.value >= 110) classification = "Acima da Média";
    if (result.value >= 125) classification = "Superior";
    if (result.value >= 140) classification = "Superdotação / Genialidade";

    gameContent.innerHTML = `
        <h2>Teste Finalizado</h2>
        <div class="status-text" style="color: var(--primary); font-weight: bold;">${classification}</div>
        
        <div style="display: flex; justify-content: center; align-items: baseline; gap: 10px; margin: 10px 0;">
            <div class="big-number" style="margin: 0; font-size: 4rem; color: var(--text-main);">${result.value}</div>
            <div style="font-size: 1.2rem; color: var(--text-sec);">(${result.label})</div>
        </div>
        
        <div style="color: var(--text-sec); font-size: 0.9rem; margin-bottom: 20px;">
            QI Estimado (Velocidade de Processamento)
        </div>
        
        <p>Acertos: <b>${state.score}</b>/${config.totalRounds}</p>
        <p style="font-size: 0.75rem; margin-top: 5px; opacity: 0.7;">
            ${config.totalRounds} Rounds | ${config.digits || 'Aleat.'} dig | ${config.memTime}s mem
        </p>

        <input type="text" id="player-name" placeholder="Seu nome" style="margin: 20px 0;">
        <button class="btn" onclick='saveScore(${JSON.stringify(result)})'>Salvar Resultado</button>
        <button class="btn btn-secondary" onclick="showMenu()">Voltar ao Menu</button>
    `;
}

// --- RANKING LOGIC ---

function getRanking() {
    return JSON.parse(localStorage.getItem('neuroSpeedRank')) || [];
}

function saveScore(iqResult) {
    const name = document.getElementById('player-name').value || "Anônimo";
    const rank = getRanking();
    
    const iqVal = iqResult ? iqResult.value : 0;
    const iqDev = iqResult ? iqResult.deviation : 0;

    const newEntry = {
        name: name,
        score: state.score,
        totalRounds: config.totalRounds, // Salvamos o total de rounds também
        iq: iqVal,
        deviation: iqDev,
        diff: config.difficulty,
        date: new Date().toLocaleDateString()
    };

    rank.push(newEntry);
    rank.sort((a, b) => b.iq - a.iq);
    
    localStorage.setItem('neuroSpeedRank', JSON.stringify(rank));
    showRanking();
}

function showRanking() {
    switchScreen('ranking');
    const list = document.getElementById('ranking-list');
    const rank = getRanking();
    
    list.innerHTML = rank.length ? '' : '<li style="padding:10px; text-align:center">Sem registros ainda.</li>';
    
    rank.forEach((r, i) => {
        const li = document.createElement('li');
        li.className = 'ranking-item';
        
        const devDisplay = r.deviation ? `<small style="font-size:0.7em; opacity:0.6">±${r.deviation}</small>` : '';
        const iqDisplay = r.iq ? `QI ${r.iq}${devDisplay}` : `${r.score} pts`;
        
        // Exibir o total de rounds no ranking para contexto
        const roundsInfo = r.totalRounds ? `/${r.totalRounds}` : '/10';

        li.innerHTML = `
            <div style="text-align:left">
                <span style="color: var(--primary); font-weight:bold;">#${i+1}</span> 
                <b>${r.name}</b> 
                <div style="font-size: 0.75rem; color: var(--text-sec);">${r.date} • ${r.diff.toUpperCase()}</div>
            </div>
            <div style="text-align:right">
                <div class="rank-score" style="font-size: 1.1rem;">${iqDisplay}</div>
                <small style="font-size: 0.8rem;">${r.score}${roundsInfo} acertos</small>
            </div>
        `;
        list.appendChild(li);
    });
}

function clearRanking() {
    if(confirm("Tem certeza que deseja apagar TODO o histórico de ranking? Essa ação não pode ser desfeita.")) {
        localStorage.removeItem('neuroSpeedRank');
        showRanking();
    }
}

function showMenu() {
    switchScreen('menu');
}

// --- EXPORT / IMPORT ---

function exportRanking() {
    const data = localStorage.getItem('neuroSpeedRank');
    if(!data) return alert("Nada para exportar!");
    
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neurospeed_ranking.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function importRanking(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);
            if(Array.isArray(json)) {
                localStorage.setItem('neuroSpeedRank', JSON.stringify(json));
                alert("Ranking importado com sucesso!");
                showRanking();
            } else {
                alert("Arquivo JSON inválido.");
            }
        } catch(err) {
            alert("Erro ao ler arquivo.");
        }
    };
    reader.readAsText(file);
}

// --- THEME ---
function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById('theme-icon');
    let newTheme = '';

    if(body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        icon.className = 'fas fa-moon';
        newTheme = 'light';
    } else {
        body.setAttribute('data-theme', 'dark');
        icon.className = 'fas fa-sun';
        newTheme = 'dark';
    }
    localStorage.setItem('neuroSpeedTheme', newTheme);
}