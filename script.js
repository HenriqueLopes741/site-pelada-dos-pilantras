/* --- TORNANDO AS VARIÁVEIS GLOBAIS (Para o Firebase acessar) --- */
window.estado = JSON.parse(localStorage.getItem("pelada")) || {
    times: [],
    sobrando: []
};

/* VARIÁVEIS DO TIMER (Também globais) */
window.tempoPadrao = 600; // 10 minutos
window.tempoRestante = window.tempoPadrao;
window.intervalo = null;
window.dataAlvo = null;

/* CARREGAR TEMA */
if (localStorage.getItem("tema") === "light") {
    document.body.classList.add("light");
}

/* --- FUNÇÕES AUXILIARES VISUAIS --- */

function darFeedback() {
    if (navigator.vibrate) navigator.vibrate(50);
}

function toast(msg) {
    const t = document.createElement("div");
    t.innerText = msg;
    t.style.cssText = "position:fixed; bottom:140px; left:50%; transform:translateX(-50%); background:#22c55e; color:white; padding:10px 20px; border-radius:30px; z-index:9000; font-weight:bold; box-shadow:0 4px 15px rgba(0,0,0,0.5); animation: entradaSuave 0.3s forwards;";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

/* --- FUNÇÕES PRINCIPAIS EXPOSTAS (WINDOW) --- */

// Agora a função renderizar é global!
window.renderizar = function(deveSalvarNuvem = true) {
    const containerJogando = document.getElementById("jogando");
    const containerProxima = document.getElementById("proxima");
    const containerSobrando = document.getElementById("sobrando");
    const containerRanking = document.getElementById("ranking");

    if(!containerJogando) return;

    containerJogando.innerHTML = "";
    containerProxima.innerHTML = "";
    containerSobrando.innerHTML = "";
    containerRanking.innerHTML = "";

    // Usa window.estado para garantir que pega os dados novos do Firebase
    window.estado.times.forEach(time => {
        const card = document.createElement("div");
        card.className = "time";
        card.dataset.id = time.nome; 
        
        card.innerHTML = `
            <h3>
                ${time.nome} <span>${time.vitorias || 0} 🏆</span>
            </h3>
            <div class="lista-jogadores group-jogadores" data-time="${time.nome}">
                ${time.jogadores.map(nome => htmlJogador(nome)).join('')}
            </div>
        `;

        if (time.status === "jogando") {
            containerJogando.appendChild(card);
        } else {
            containerProxima.appendChild(card);
        }
    });

    window.estado.sobrando.forEach(nome => {
        containerSobrando.innerHTML += htmlJogador(nome);
    });

    const rankingOrdenado = [...window.estado.times].sort((a,b) => (b.vitorias||0) - (a.vitorias||0));
    rankingOrdenado.forEach((t, i) => {
        const nomesAtletas = t.jogadores.length > 0 ? t.jogadores.join(", ") : "Sem jogadores";
        
        containerRanking.innerHTML += `
            <div class="rank-item" style="display:flex; flex-direction: column; align-items: flex-start; gap: 4px;">
                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <span>#${i+1} <b>${t.nome}</b></span> 
                    <span>${t.vitorias||0} vitórias</span>
                </div>
                <small style="opacity: 0.6; font-size: 11px;">🏃 ${nomesAtletas}</small>
            </div>`;
    });

    // Se deveSalvarNuvem for FALSE (veio do Firebase), a gente pula o envio para não criar loop
    salvar(deveSalvarNuvem);
    
    atualizarTempoDisplay();
    iniciarSortables();
}

function salvar(enviarFirebase = true) {
    localStorage.setItem("pelada", JSON.stringify(window.estado));
    
    // A mágica acontece aqui:
    if (enviarFirebase && typeof window.enviarParaNuvem === "function") {
        console.log("📤 Enviando alteração local para o Firebase...");
        window.enviarParaNuvem(window.estado);
    }
}

function htmlJogador(nome) {
    return `
        <div class="jogador" data-nome="${nome}">
            ${nome}
            <button class="remove-btn" onclick="removerJogador('${nome}')">×</button>
        </div>
    `;
}

/* --- LÓGICA DO SORTABLE JS --- */
function iniciarSortables() {
    const areasTimes = [document.getElementById('jogando'), document.getElementById('proxima')];
    areasTimes.forEach(area => {
        if(area) {
            new Sortable(area, {
                group: 'times',
                animation: 150,
                handle: 'h3',
                onEnd: () => sincronizarEstadoComDOM()
            });
        }
    });

    const areasJogadores = document.querySelectorAll('.lista-jogadores, #sobrando');
    areasJogadores.forEach(area => {
        new Sortable(area, {
            group: 'jogadores',
            animation: 150,
            onEnd: () => {
                darFeedback(); 
                sincronizarEstadoComDOM();
            }
        });
    });
}

function sincronizarEstadoComDOM() {
    const timesAtualizados = [];
    
    document.getElementById("jogando").querySelectorAll(".time").forEach(el => {
        timesAtualizados.push(montarObjetoTime(el, "jogando"));
    });

    document.getElementById("proxima").querySelectorAll(".time").forEach(el => {
        timesAtualizados.push(montarObjetoTime(el, "proxima"));
    });

    const novosSobrando = [];
    document.getElementById("sobrando").querySelectorAll(".jogador").forEach(el => {
        novosSobrando.push(el.dataset.nome);
    });

    window.estado.sobrando = novosSobrando;
    
    window.estado.times = timesAtualizados.map(novoT => {
        const antigoT = window.estado.times.find(t => t.nome === novoT.nome);
        if (antigoT) novoT.vitorias = antigoT.vitorias;
        return novoT;
    });

    // Salva e manda pro Firebase porque foi uma mexida manual (drag and drop)
    salvar(true);
}

function montarObjetoTime(elementoDOM, status) {
    const nome = elementoDOM.dataset.id;
    const jogadores = [];
    elementoDOM.querySelectorAll(".jogador").forEach(j => {
        jogadores.push(j.dataset.nome);
    });
    return { nome, status, jogadores, vitorias: 0 };
}

/* --- AÇÕES DO JOGO --- */

function adicionarJogadoresMassa() {
    darFeedback();
    const input = document.getElementById("nomeJogador");
    const texto = input.value;
    if (!texto.trim()) return;

    const nomesExtraidos = texto.split(/[,|\n]/);
    let adicionou = false;
    nomesExtraidos.forEach(nome => {
        const nomeLimpo = nome.trim();
        if (nomeLimpo.length > 0 && !window.estado.sobrando.includes(nomeLimpo)) {
            window.estado.sobrando.push(nomeLimpo);
            adicionou = true;
        }
    });

    if(adicionou) toast("Jogadores adicionados!");
    input.value = ""; 
    renderizar(true); // Salva no Firebase
}

// Funções globais para o HTML acessar
window.adicionarJogador = adicionarJogadoresMassa;

window.adicionarTime = function() {
    darFeedback();
    const input = document.getElementById("nomeTime");
    if (!input.value) return;
    window.estado.times.push({
        nome: input.value,
        jogadores: [],
        status: "proxima",
        vitorias: 0
    });
    input.value = "";
    renderizar(true);
}

window.removerJogador = function(nome) {
    darFeedback();
    if(!confirm(`Remover ${nome}?`)) return;
    window.estado.sobrando = window.estado.sobrando.filter(j => j !== nome);
    window.estado.times.forEach(t => t.jogadores = t.jogadores.filter(j => j !== nome));
    renderizar(true);
}

/* --- VITORIA E EMPATE --- */

window.timeGanhou = function() {
    darFeedback();
    const jogando = window.estado.times.filter(t => t.status === "jogando");
    if (jogando.length !== 2) return alert("Precisa ter 2 times na área 'Jogando Agora'!");

    const modal = document.getElementById("modalVitoria");
    const containerOpcoes = document.getElementById("opcoesVitoria");
    containerOpcoes.innerHTML = "";

    jogando.forEach(time => {
        const btn = document.createElement("button");
        btn.className = "btn-zao-verde";
        btn.style.width = "100%";
        btn.innerHTML = `🏆 ${time.nome}`;
        btn.onclick = () => confirmarVencedor(time.nome);
        containerOpcoes.appendChild(btn);
    });
    modal.style.display = "flex";
}

function confirmarVencedor(nomeVencedor) {
    darFeedback();
    if (typeof confetti === "function") {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            zIndex: 9999
        });
    }

    const jogando = window.estado.times.filter(t => t.status === "jogando");
    const vencedor = jogando.find(t => t.nome === nomeVencedor);
    const perdedor = jogando.find(t => t.nome !== nomeVencedor);

    if (vencedor) vencedor.vitorias = (vencedor.vitorias || 0) + 1;
    if (perdedor) perdedor.status = "proxima";

    window.estado.times = window.estado.times.filter(t => t !== perdedor);
    window.estado.times.push(perdedor);

    const proximo = window.estado.times.find(t => t.status === "proxima" && t !== perdedor);
    if (proximo) proximo.status = "jogando";

    fecharModalVitoria();
    resetarTimer();
    renderizar(true);
    toast(`Vitória do ${nomeVencedor}!`);
}

window.fecharModalVitoria = function() {
    document.getElementById("modalVitoria").style.display = "none";
}

window.empate = function() {
    darFeedback();
    if (!confirm("Confirmar empate? Os dois saem.")) return;
    const jogando = window.estado.times.filter(t => t.status === "jogando");
    
    jogando.forEach(t => {
        t.status = "proxima";
        window.estado.times = window.estado.times.filter(x => x !== t);
        window.estado.times.push(t);
    });

    const proximos = window.estado.times.filter(t => t.status === "proxima").slice(0, 2);
    proximos.forEach(t => t.status = "jogando");

    resetarTimer();
    renderizar(true);
    toast("Empate! Próximos times.");
}

window.resetarTudo = function() {
    darFeedback();
    if (confirm("Apagar tudo e começar do zero?")) {
        localStorage.removeItem("pelada");
        // Envia estado vazio pro firebase
        if(typeof window.enviarParaNuvem === "function") {
             window.enviarParaNuvem({ times: [], sobrando: [] });
        }
        location.reload();
    }
}

/* --- TIMER --- */
window.iniciarTimer = function() {
    darFeedback();
    if (window.intervalo) return;
    const som = document.getElementById("somFim");
    if(som) som.load(); 
    window.dataAlvo = Date.now() + (window.tempoRestante * 1000);
    
    window.intervalo = setInterval(() => {
        const agora = Date.now();
        const diff = Math.ceil((window.dataAlvo - agora) / 1000);
        if (diff <= 0) {
            window.tempoRestante = 0;
            pausarTimer();
            tocarSom();
        } else {
            window.tempoRestante = diff;
        }
        atualizarTempoDisplay();
    }, 1000);
}

window.pausarTimer = function() {
    if(window.intervalo) darFeedback();
    clearInterval(window.intervalo);
    window.intervalo = null;
}

window.resetarTimer = function() {
    darFeedback();
    pausarTimer();
    window.tempoRestante = window.tempoPadrao;
    atualizarTempoDisplay();
}

function atualizarTempoDisplay() {
    const display = document.getElementById("tempo");
    if(!display) return;
    const m = Math.floor(window.tempoRestante / 60).toString().padStart(2, '0');
    const s = (window.tempoRestante % 60).toString().padStart(2, '0');
    display.innerText = `${m}:${s}`;
    
    if (window.tempoRestante === 0) {
        display.style.color = "#ef4444";
        display.style.animation = "pulsar 0.5s infinite";
    } else {
        display.style.color = "#fbbf24";
        display.style.animation = "none";
    }
}

function tocarSom() {
    const audio = document.getElementById("somFim");
    if(audio) audio.play().catch(e => console.log(e));
    darFeedback(); 
    if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
    alert("FIM DE JOGO! ⏱️");
}

/* --- UTILITÁRIOS --- */
window.alternarTema = function() {
    document.body.classList.toggle("light");
    localStorage.setItem("tema", document.body.classList.contains("light") ? "light" : "dark");
}

window.gerarPrintRanking = function() {
    darFeedback();
    const r = document.getElementById("ranking");
    html2canvas(r).then(canvas => {
        const link = document.createElement('a');
        link.download = 'ranking-pelada.png';
        link.href = canvas.toDataURL();
        link.click();
    });
}

window.sortearTimes = function() {
    darFeedback();
    if (window.estado.sobrando.length === 0) return alert("Não há jogadores sobrando!");

    let jogadoresParaSortear = [...window.estado.sobrando];
    for (let i = jogadoresParaSortear.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [jogadoresParaSortear[i], jogadoresParaSortear[j]] = [jogadoresParaSortear[j], jogadoresParaSortear[i]];
    }

    window.estado.times.forEach(time => {
        while (time.jogadores.length < 5 && jogadoresParaSortear.length > 0) {
            time.jogadores.push(jogadoresParaSortear.shift());
        }
    });

    window.estado.sobrando = jogadoresParaSortear;
    renderizar(true);
    toast("Times sorteados!");
}

window.abrirAjuda = function() { document.getElementById('modalAjuda').style.display = 'flex'; }
window.fecharAjuda = function() { document.getElementById('modalAjuda').style.display = 'none'; }

window.adicionarMinuto = function() {
    darFeedback();
    window.tempoRestante += 60;
    if (!window.intervalo) {
        atualizarTempoDisplay();
    } else {
        window.dataAlvo += 60000;
    }
}

window.mudarTempoPadrao = function(minutos) {
    window.tempoPadrao = minutos * 60;
    window.tempoRestante = window.tempoPadrao;
    atualizarTempoDisplay();
    salvar();
}

// Hack iOS áudio
document.body.addEventListener('touchstart', function() {
    const a = document.getElementById("somFim");
    if(a) { a.play().then(() => { a.pause(); a.currentTime=0; }).catch(()=>{}); }
}, {once:true});

window.verificarSenha = function() {
    const senhaCorreta = "PILANTRA123"; 
    const senhaDigitada = document.getElementById("senhaAcesso").value;
    const erro = document.getElementById("erroLogin");

    if (senhaDigitada === senhaCorreta) {
        document.getElementById("telaLogin").style.display = "none";
        sessionStorage.setItem("autorizado", "true"); 
        darFeedback();
    } else {
        erro.style.display = "block";
        if(navigator.vibrate) navigator.vibrate([100, 50, 100]); 
        alert("Senha incorreta!");
    }
}

// Verifica se já estava logado e renderiza
window.onload = () => {
    if (sessionStorage.getItem("autorizado") === "true") {
        document.getElementById("telaLogin").style.display = "none";
    }
    // Renderiza o que tem localmente enquanto o Firebase não carrega
    renderizar(false);
};