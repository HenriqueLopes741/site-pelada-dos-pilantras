/* ESTADO INICIAL */
let estado = JSON.parse(localStorage.getItem("pelada")) || {
  times: [],
  sobrando: []
};

/* VARIÁVEIS DO TIMER */
let tempoPadrao = 600; // 10 minutos
let tempoRestante = tempoPadrao;
let intervalo = null;
let dataAlvo = null;

/* CARREGAR TEMA */
if (localStorage.getItem("tema") === "light") {
  document.body.classList.add("light");
}

/* --- FUNÇÕES PRINCIPAIS --- */

function renderizar() {
  const containerJogando = document.getElementById("jogando");
  const containerProxima = document.getElementById("proxima");
  const containerSobrando = document.getElementById("sobrando");
  const containerRanking = document.getElementById("ranking");

  if(!containerJogando) return; // Evita erros se o DOM não estiver pronto

  containerJogando.innerHTML = "";
  containerProxima.innerHTML = "";
  containerSobrando.innerHTML = "";
  containerRanking.innerHTML = "";

  estado.times.forEach(time => {
    const card = document.createElement("div");
    card.className = "time";
    card.dataset.id = time.nome; 
    
    card.innerHTML = `
      <h3>${time.nome} <span>${time.vitorias || 0} 🏆</span></h3>
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

  estado.sobrando.forEach(nome => {
    containerSobrando.innerHTML += htmlJogador(nome);
  });

  const rankingOrdenado = [...estado.times].sort((a,b) => (b.vitorias||0) - (a.vitorias||0));
  rankingOrdenado.forEach((t, i) => {
    const nomesAtletas = t.jogadores.length > 0 ? t.jogadores.join(", ") : "Sem jogadores";
    
    containerRanking.innerHTML += `
      <div class="rank-item" style="flex-direction: column; align-items: flex-start; gap: 4px;">
        <div style="display: flex; justify-content: space-between; width: 100%;">
          <span>#${i+1} <b>${t.nome}</b></span> 
          <span>${t.vitorias||0} vitórias</span>
        </div>
        <small style="opacity: 0.6; font-size: 11px;">🏃 ${nomesAtletas}</small>
      </div>`;
  });

  salvar();
  atualizarTempoDisplay();
  iniciarSortables();
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
      onEnd: () => sincronizarEstadoComDOM()
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

  estado.sobrando = novosSobrando;
  
  estado.times = timesAtualizados.map(novoT => {
    const antigoT = estado.times.find(t => t.nome === novoT.nome);
    if (antigoT) novoT.vitorias = antigoT.vitorias;
    return novoT;
  });

  salvar();
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
  const input = document.getElementById("nomeJogador");
  const texto = input.value;
  if (!texto.trim()) return;

  const nomesExtraidos = texto.split(/[,|\n]/);
  nomesExtraidos.forEach(nome => {
    const nomeLimpo = nome.trim();
    if (nomeLimpo.length > 0 && !estado.sobrando.includes(nomeLimpo)) {
      estado.sobrando.push(nomeLimpo);
    }
  });

  input.value = ""; 
  renderizar();
}

function adicionarJogador() { adicionarJogadoresMassa(); }

function adicionarTime() {
  const input = document.getElementById("nomeTime");
  if (!input.value) return;
  estado.times.push({
    nome: input.value,
    jogadores: [],
    status: "proxima",
    vitorias: 0
  });
  input.value = "";
  renderizar();
}

function removerJogador(nome) {
  if(!confirm(`Remover ${nome}?`)) return;
  estado.sobrando = estado.sobrando.filter(j => j !== nome);
  estado.times.forEach(t => t.jogadores = t.jogadores.filter(j => j !== nome));
  renderizar();
}

/* --- VITORIA E EMPATE --- */

function timeGanhou() {
  const jogando = estado.times.filter(t => t.status === "jogando");
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
  // --- CHUVA DE CONFETE ---
  if (typeof confetti === "function") {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      zIndex: 9999
    });
  }

  const jogando = estado.times.filter(t => t.status === "jogando");
  const vencedor = jogando.find(t => t.nome === nomeVencedor);
  const perdedor = jogando.find(t => t.nome !== nomeVencedor);

  if (vencedor) vencedor.vitorias = (vencedor.vitorias || 0) + 1;
  if (perdedor) perdedor.status = "proxima";

  // Reposiciona perdedor no fim da fila
  estado.times = estado.times.filter(t => t !== perdedor);
  estado.times.push(perdedor);

  // Coloca o próximo para jogar
  const proximo = estado.times.find(t => t.status === "proxima" && t !== perdedor);
  if (proximo) proximo.status = "jogando";

  fecharModalVitoria();
  resetarTimer();
  renderizar();
}

function fecharModalVitoria() {
  document.getElementById("modalVitoria").style.display = "none";
}

function empate() {
  if (!confirm("Confirmar empate? Os dois saem.")) return;
  const jogando = estado.times.filter(t => t.status === "jogando");
  
  jogando.forEach(t => {
    t.status = "proxima";
    estado.times = estado.times.filter(x => x !== t);
    estado.times.push(t);
  });

  const proximos = estado.times.filter(t => t.status === "proxima").slice(0, 2);
  proximos.forEach(t => t.status = "jogando");

  resetarTimer();
  renderizar();
}

function resetarTudo() {
  if (confirm("Apagar tudo e começar do zero?")) {
    localStorage.removeItem("pelada");
    location.reload();
  }
}

/* --- TIMER --- */
function iniciarTimer() {
  if (intervalo) return;
  const som = document.getElementById("somFim");
  if(som) som.load(); 
  dataAlvo = Date.now() + (tempoRestante * 1000);
  intervalo = setInterval(() => {
    const agora = Date.now();
    const diff = Math.ceil((dataAlvo - agora) / 1000);
    if (diff <= 0) {
      tempoRestante = 0;
      pausarTimer();
      tocarSom();
    } else {
      tempoRestante = diff;
    }
    atualizarTempoDisplay();
  }, 1000);
}

function pausarTimer() {
  clearInterval(intervalo);
  intervalo = null;
}

function resetarTimer() {
  pausarTimer();
  tempoRestante = tempoPadrao;
  atualizarTempoDisplay();
}

function atualizarTempoDisplay() {
  const display = document.getElementById("tempo");
  if(!display) return;
  const m = Math.floor(tempoRestante / 60).toString().padStart(2, '0');
  const s = (tempoRestante % 60).toString().padStart(2, '0');
  display.innerText = `${m}:${s}`;
}

function tocarSom() {
  const audio = document.getElementById("somFim");
  if(audio) audio.play().catch(e => console.log(e));
  alert("FIM DE JOGO! ⏱️");
}

/* --- UTILITÁRIOS --- */
function alternarTema() {
  document.body.classList.toggle("light");
  localStorage.setItem("tema", document.body.classList.contains("light") ? "light" : "dark");
}

function salvar() {
  localStorage.setItem("pelada", JSON.stringify(estado));
}

function gerarPrintRanking() {
  const r = document.getElementById("ranking");
  html2canvas(r).then(canvas => {
    const link = document.createElement('a');
    link.download = 'ranking-pelada.png';
    link.href = canvas.toDataURL();
    link.click();
  });
}

function sortearTimes() {
  if (estado.sobrando.length === 0) return alert("Não há jogadores sobrando!");

  let jogadoresParaSortear = [...estado.sobrando];
  for (let i = jogadoresParaSortear.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [jogadoresParaSortear[i], jogadoresParaSortear[j]] = [jogadoresParaSortear[j], jogadoresParaSortear[i]];
  }

  estado.times.forEach(time => {
    while (time.jogadores.length < 5 && jogadoresParaSortear.length > 0) {
      time.jogadores.push(jogadoresParaSortear.shift());
    }
  });

  estado.sobrando = jogadoresParaSortear;
  renderizar();
}

function abrirAjuda() { document.getElementById('modalAjuda').style.display = 'flex'; }
function fecharAjuda() { document.getElementById('modalAjuda').style.display = 'none'; }

function adicionarMinuto() {
  tempoRestante += 60;
  if (!intervalo) {
    atualizarTempoDisplay();
  } else {
    dataAlvo += 60000;
  }
}

function mudarTempoPadrao(minutos) {
  tempoPadrao = minutos * 60;
  tempoRestante = tempoPadrao;
  atualizarTempoDisplay();
  salvar();
}

// Hack iOS áudio
document.body.addEventListener('touchstart', function() {
  const a = document.getElementById("somFim");
  if(a) { a.play().then(() => { a.pause(); a.currentTime=0; }).catch(()=>{}); }
}, {once:true});

// INICIALIZAÇÃO
renderizar();