/* --- CONFIGURAÇÃO INICIAL GLOBAL --- */
// Definimos window.estado para garantir que todos vejam a mesma coisa
// trava de sincronização
window.vindoDaNuvem = false;
window.alertaTempoDisparado = false;


// id único do dispositivo
window.deviceId = localStorage.getItem("deviceId");
if (!window.deviceId) {
    window.deviceId = crypto.randomUUID();
    localStorage.setItem("deviceId", window.deviceId);
}


window.estado = window.estado || {
    times: [],
    sobrando: []
};

// Variáveis do Timer Globais
window.tempoPadrao = 600; // 10 minutos
window.tempoRestante = window.tempoPadrao;
window.intervalo = null;

/* --- CARREGAR TEMA --- */
if (localStorage.getItem("tema") === "light") {
    document.body.classList.add("light");
}

/* --- FUNÇÃO PRINCIPAL: DESENHAR A TELA --- */
// Essa função é chamada pelo Firebase quando chega dado novo
window.renderizar = function(deveSalvar = true) {
    const containerJogando = document.getElementById("jogando");
    const containerProxima = document.getElementById("proxima");
    const containerSobrando = document.getElementById("sobrando");
    const containerRanking = document.getElementById("ranking");

    if (!containerJogando) return; // Segurança

    // 1. Limpa tudo
    containerJogando.innerHTML = "";
    containerProxima.innerHTML = "";
    containerSobrando.innerHTML = "";
    containerRanking.innerHTML = "";

    // 2. Desenha Times
    if (window.estado.times) {
        window.estado.times.forEach(time => {
            const div = document.createElement("div");
            div.className = "time";
            div.dataset.id = time.nome;
            div.innerHTML = `
                <h3>${time.nome} <span>${time.vitorias || 0} 🏆</span></h3>
                <div class="lista-jogadores group-jogadores" data-time="${time.nome}">
                    ${(time.jogadores || []).map(nome => htmlJogador(nome)).join('')}
                </div>
            `;
            if (time.status === "jogando") containerJogando.appendChild(div);
            else containerProxima.appendChild(div);
        });
    }

    // 3. Desenha Sobrando
    if (window.estado.sobrando) {
        window.estado.sobrando.forEach(nome => {
            containerSobrando.innerHTML += htmlJogador(nome);
        });
    }

    // 4. Desenha Ranking
    if (window.estado.times) {
        const ranking = [...window.estado.times].sort((a,b) => (b.vitorias||0) - (a.vitorias||0));
        ranking.forEach((t, i) => {
            const nomes = (t.jogadores || []).join(", ");
            containerRanking.innerHTML += `
                <div style="border-bottom:1px solid #333; padding:5px; margin-bottom:5px;">
                    <div style="display:flex; justify-content:space-between; font-weight:bold;">
                        <span>#${i+1} ${t.nome}</span>
                        <span>${t.vitorias||0} vit</span>
                    </div>
                    <small style="opacity:0.6">${nomes}</small>
                </div>
            `;
        });
    }

    // 5. Salva na nuvem (se não veio da nuvem)
    // 5. Salva na nuvem (se não veio da nuvem)

        // 🔥 ADICIONADO — sincroniza o tempo baseado na nuvem
    // 🔥 5. sincroniza o tempo baseado na nuvem
if (window.estado.timer) {
    const agora = Date.now();
    const passou = Math.floor((agora - window.estado.timer.inicio) / 1000);
    window.tempoRestante = Math.max(
        window.estado.timer.duracao - passou,
        0
    );

    if (window.tempoRestante === 0 && !window.alertaTempoDisparado) {
        window.alertaTempoDisparado = true;
        tocarSom();
    }
}

// 🔥 6. salva na nuvem (UMA ÚNICA VEZ)
if (deveSalvar && !window.vindoDaNuvem) {
    window.estado._lastUpdateBy = window.deviceId;
    salvarNoFirebase();
}

atualizarTempoDisplay();
iniciarSortables();

};

/* --- FUNÇÃO SALVAR --- */
function salvarNoFirebase() {
    // Verifica se a função de enviar existe (criada no index.html)
    if (typeof window.enviarParaNuvem === "function") {
        window.enviarParaNuvem(window.estado);
    } else {
        console.warn("Firebase ainda não carregou, salvando apenas localmente.");
    }
    localStorage.setItem("pelada_backup", JSON.stringify(window.estado));
}

/* --- HTML AUXILIAR --- */
function htmlJogador(nome) {
    return `<div class="jogador" data-nome="${nome}">
                ${nome} 
                <button onclick="removerJogador('${nome}')" style="margin-left:5px; color:red; background:none; border:none; font-weight:bold;">×</button>
            </div>`;
}

/* --- AÇÕES DO USUÁRIO --- */
window.adicionarJogador = function() {
    const input = document.getElementById("nomeJogador");
    const nome = input.value.trim();
    if (!nome) return;
    
    if (!window.estado.sobrando) window.estado.sobrando = [];
    
    if (!window.estado.sobrando.includes(nome)) {
        window.estado.sobrando.push(nome);
        input.value = "";
        renderizar(true); // Salva e envia
        darFeedback();
    }
};

window.adicionarTime = function() {
    const input = document.getElementById("nomeTime");
    const nome = input.value.trim();
    if (!nome) return;

    if (!window.estado.times) window.estado.times = [];

    window.estado.times.push({
        nome: nome,
        jogadores: [],
        status: "proxima",
        vitorias: 0
    });
    input.value = "";
    renderizar(true);
    darFeedback();
};

window.removerJogador = function(nome) {
    if (!confirm("Remover " + nome + "?")) return;
    
    if (window.estado.sobrando)
        window.estado.sobrando = window.estado.sobrando.filter(j => j !== nome);
    
    if (window.estado.times)
        window.estado.times.forEach(t => t.jogadores = t.jogadores.filter(j => j !== nome));
        
    renderizar(true);
};

window.sortearTimes = function() {
    if (!window.estado.sobrando || window.estado.sobrando.length === 0) 
        return alert("Ninguém sobrando para sortear!");

    let pool = [...window.estado.sobrando];
    // Embaralha (Fisher-Yates)
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    window.estado.times.forEach(time => {
        // Enche o time até ter 5 ou acabar os jogadores
        while (time.jogadores.length < 5 && pool.length > 0) {
            time.jogadores.push(pool.shift());
        }
    });

    window.estado.sobrando = pool;
    renderizar(true);
    alert("Times sorteados!");
};

/* --- DRAG AND DROP (Sortable) --- */
function iniciarSortables() {
    const areas = ['jogando', 'proxima', 'sobrando'];
    const containers = document.querySelectorAll('.lista-jogadores, .container-times');
    
    // Configura drag and drop para jogadores e times
    const els = document.querySelectorAll('#jogando, #proxima, #sobrando, .lista-jogadores');
    els.forEach(el => {
        new Sortable(el, {
            group: el.id === 'jogando' || el.id === 'proxima' ? 'times' : 'jogadores',
            animation: 150,
            onEnd: () => sincronizarDOM()
        });
    });
}

function sincronizarDOM() {
    // Reconstrói o estado olhando para a tela
    const novosTimes = [];
    
    // Ler times Jogando
    document.querySelectorAll("#jogando .time").forEach(el => novosTimes.push(lerTimeDOM(el, "jogando")));
    // Ler times Proxima
    document.querySelectorAll("#proxima .time").forEach(el => novosTimes.push(lerTimeDOM(el, "proxima")));
    
    // Ler Sobrando
    const novosSobrando = [];
    document.querySelectorAll("#sobrando .jogador").forEach(el => novosSobrando.push(el.dataset.nome));

    window.estado.sobrando = novosSobrando;
    
    // Preserva vitórias antigas
    window.estado.times = novosTimes.map(nt => {
        const old = (window.estado.times || []).find(t => t.nome === nt.nome);
        if (old) nt.vitorias = old.vitorias;
        return nt;
    });

    renderizar(true); // Salva a nova ordem
}

function lerTimeDOM(el, status) {
    const nome = el.dataset.id;
    const jogadores = [];
    el.querySelectorAll(".jogador").forEach(j => jogadores.push(j.dataset.nome));
    return { nome, status, jogadores, vitorias: 0 };
}

/* --- VITORIA / EMPATE --- */
window.timeGanhou = function() {
    const jogando = window.estado.times.filter(t => t.status === "jogando");
    if (jogando.length !== 2) return alert("Precisa de 2 times jogando!");
    
    const modal = document.getElementById("modalVitoria");
    const container = document.getElementById("opcoesVitoria");
    container.innerHTML = "";
    
    jogando.forEach(t => {
        const btn = document.createElement("button");
        btn.innerText = "🏆 " + t.nome;
        btn.className = "btn-zao-verde";
        btn.onclick = () => confirmarVitoria(t.nome);
        container.appendChild(btn);
    });
    modal.style.display = "flex";
};

window.confirmarVitoria = function(nomeVencedor) {
    // Confete
    if(window.confetti) window.confetti();

    const jogando = window.estado.times.filter(t => t.status === "jogando");
    const vencedor = jogando.find(t => t.nome === nomeVencedor);
    const perdedor = jogando.find(t => t.nome !== nomeVencedor);
    
    if(vencedor) vencedor.vitorias = (vencedor.vitorias || 0) + 1;
    if(perdedor) perdedor.status = "proxima";
    
    // Move perdedor pro fim da fila
    window.estado.times = window.estado.times.filter(t => t !== perdedor);
    window.estado.times.push(perdedor);
    
    // Puxa o próximo
    const proximo = window.estado.times.find(t => t.status === "proxima" && t !== perdedor);
    if(proximo) proximo.status = "jogando";
    
    document.getElementById("modalVitoria").style.display = "none";
    resetarTimer();
    renderizar(true);
};

window.empate = function() {
    if(!confirm("Empate? Os dois saem.")) return;
    const jogando = window.estado.times.filter(t => t.status === "jogando");
    
    jogando.forEach(t => {
        t.status = "proxima";
        // Move pro fim
        window.estado.times = window.estado.times.filter(x => x !== t);
        window.estado.times.push(t);
    });
    
    // Puxa 2 novos
    const proximos = window.estado.times.filter(t => t.status === "proxima").slice(0,2);
    proximos.forEach(t => t.status = "jogando");
    
    resetarTimer();
    renderizar(true);
};

window.fecharModalVitoria = () => document.getElementById("modalVitoria").style.display = "none";
window.resetarTudo = () => {
    if(confirm("Zerar tudo?")) {
        window.estado = { times: [], sobrando: [] };
        renderizar(true);
        location.reload();
    }
};

/* --- TIMER E UTILITÁRIOS --- */
function atualizarTempoDisplay() {
    const display = document.getElementById("tempo");
    if(!display) return;
    const m = Math.floor(window.tempoRestante / 60).toString().padStart(2,'0');
    const s = (window.tempoRestante % 60).toString().padStart(2,'0');
    display.innerText = `${m}:${s}`;
}

window.iniciarTimer = function() {
    window.alertaTempoDisparado = false;
    window.estado.timer = {
        inicio: Date.now(),
        duracao: window.tempoPadrao
    };
    renderizar(true);
};


window.pausarTimer = function() {
    if (!window.estado.timer) return;

    const agora = Date.now();
    const passou = Math.floor((agora - window.estado.timer.inicio) / 1000);
    window.estado.timer.duracao = Math.max(
        window.estado.timer.duracao - passou,
        0
    );

    delete window.estado.timer.inicio;
    renderizar(true);
    darFeedback();
};


window.resetarTimer = function() {
    window.alertaTempoDisparado = false;
    delete window.estado.timer;
    window.tempoRestante = window.tempoPadrao;
    atualizarTempoDisplay();
    renderizar(true);
    darFeedback();
};



window.adicionarMinuto = function() {
    if (!window.estado.timer) return;
    window.estado.timer.duracao += 60;
    renderizar(true);
};
window.mudarTempoPadrao = function(t) { window.tempoPadrao = t*60; window.tempoRestante = window.tempoPadrao; atualizarTempoDisplay(); };

function tocarSom() {
    const audio = document.getElementById("somFim");
    if(audio) audio.play();
    alert("ACABOU O TEMPO!");
}

function darFeedback() { if(navigator.vibrate) navigator.vibrate(50); }

/* --- AUTENTICAÇÃO SIMPLES --- */
window.verificarSenha = function() {
    if(document.getElementById("senhaAcesso").value === "PILANTRA123") {
        document.getElementById("telaLogin").style.display = "none";
        sessionStorage.setItem("logado", "true");
    } else {
        document.getElementById("erroLogin").style.display = "block";
    }
};

if(sessionStorage.getItem("logado") === "true") {
    document.getElementById("telaLogin").style.display = "none";
}

// Inicializa visualmente (esperando firebase)
renderizar(false);