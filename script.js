/* ESTADO INICIAL */
let estado = JSON.parse(localStorage.getItem("pelada")) || {
  times: [],
  sobrando: []
};

/* VARIÁVEIS DO TIMER */
let tempoPadrao = 600; // 10 minutos em segundos
let tempoRestante = tempoPadrao;
let intervalo = null;
let dataAlvo = null; // Para calcular tempo real

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

  // RANKING COM JOGADORES PARA O PRINT
  const rankingOrdenado = [...estado.times].sort((a,b) => (b.vitorias||0) - (a.vitorias||0));
  rankingOrdenado.forEach((t, i) => {
    // Aqui adicionamos a lista de nomes abaixo do nome do time no ranking
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

// Gera HTML de um jogador
function htmlJogador(nome) {
  return `
    <div class="jogador" data-nome="${nome}">
      ${nome}
      <button class="remove-btn" onclick="removerJogador('${nome}')">×</button>
    </div>
  `;
}

/* --- LÓGICA DO SORTABLE JS (A MÁGICA) --- */
function iniciarSortables() {
  
  // 1. Permite arrastar TIMES entre "Jogando" e "Próxima"
  const areasTimes = [document.getElementById('jogando'), document.getElementById('proxima')];
  areasTimes.forEach(area => {
    new Sortable(area, {
      group: 'times',
      animation: 150,
      handle: 'h3', // Só arrasta segurando no título
      onEnd: function (evt) {
        sincronizarEstadoComDOM(); // Atualiza JSON após arrastar
      }
    });
  });

  // 2. Permite arrastar JOGADORES entre Times e Sobrando
  const areasJogadores = document.querySelectorAll('.lista-jogadores');
  areasJogadores.forEach(area => {
    new Sortable(area, {
      group: 'jogadores',
      animation: 150,
      onEnd: function (evt) {
        sincronizarEstadoComDOM(); // Atualiza JSON após arrastar
      }
    });
  });
}

// Essa função lê o HTML atual e atualiza o objeto 'estado'
// É o segredo para o Sortable funcionar com LocalStorage
function sincronizarEstadoComDOM() {
  const timesAtualizados = [];
  
  // Varre Times Jogando
  document.getElementById("jogando").querySelectorAll(".time").forEach(el => {
    timesAtualizados.push(montarObjetoTime(el, "jogando"));
  });

  // Varre Times Próxima
  document.getElementById("proxima").querySelectorAll(".time").forEach(el => {
    timesAtualizados.push(montarObjetoTime(el, "proxima"));
  });

  // Atualiza Sobrando
  const novosSobrando = [];
  document.getElementById("sobrando").querySelectorAll(".jogador").forEach(el => {
    novosSobrando.push(el.dataset.nome);
  });

  // Salva no estado global (mantendo vitórias antigas)
  estado.sobrando = novosSobrando;
  
  // Mescla dados novos (posição) com antigos (vitórias)
  estado.times = timesAtualizados.map(novoT => {
    const antigoT = estado.times.find(t => t.nome === novoT.nome);
    if (antigoT) novoT.vitorias = antigoT.vitorias;
    return novoT;
  });

  salvar();
  // Nota: Não chamamos renderizar() aqui para não piscar a tela
  // Apenas atualizamos o ranking visualmente se necessário
}

function montarObjetoTime(elementoDOM, status) {
  const nome = elementoDOM.dataset.id;
  const jogadores = [];
  elementoDOM.querySelectorAll(".jogador").forEach(j => {
    jogadores.push(j.dataset.nome);
  });
  return { nome, status, jogadores, vitorias: 0 }; // vitorias recuperadas depois
}

/* --- AÇÕES DO JOGO --- */

function adicionarJogador() {
  const input = document.getElementById("nomeJogador");
  if (!input.value) return;
  estado.sobrando.push(input.value);
  input.value = "";
  renderizar();
}

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

function timeGanhou() {
  const jogando = estado.times.filter(t => t.status === "jogando");
  
  if (jogando.length !== 2) {
    return alert("Precisa ter 2 times na área 'Jogando Agora'!");
  }

  // Prepara o Modal
  const modal = document.getElementById("modalVitoria");
  const containerOpcoes = document.getElementById("opcoesVitoria");
  containerOpcoes.innerHTML = ""; // Limpa opções anteriores

  // Cria um botão grande para cada time
  jogando.forEach(time => {
    const btn = document.createElement("button");
    btn.className = "btn-zao-verde"; // Usa a classe que já criamos
    btn.style.width = "100%";
    btn.innerHTML = `🏆 ${time.nome}`;
    btn.onclick = () => confirmarVencedor(time.nome);
    containerOpcoes.appendChild(btn);
  });

  modal.style.display = "flex";
}

function confirmarVencedor(nomeVencedor) {
  const jogando = estado.times.filter(t => t.status === "jogando");
  const vencedor = jogando.find(t => t.nome === nomeVencedor);
  const perdedor = jogando.find(t => t.nome !== nomeVencedor);

  // Lógica de pontos e troca
  vencedor.vitorias = (vencedor.vitorias || 0) + 1;
  perdedor.status = "proxima";

  // Move perdedor para o final da fila no array
  estado.times = estado.times.filter(t => t !== perdedor);
  estado.times.push(perdedor);

  // Próximo entra
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
  
  // Move os dois atuais para o final da fila "proxima"
  jogando.forEach(t => {
    t.status = "proxima";
    // Mover no array para o final
    estado.times = estado.times.filter(x => x !== t);
    estado.times.push(t);
  });

  // Pega os dois próximos
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

/* --- TIMER INTELIGENTE (CORRIGIDO PARA MOBILE) --- */
function iniciarTimer() {
  if (intervalo) return;
  
  // Destrava áudio no iOS (primeiro clique)
  document.getElementById("somFim").load(); 

  // Define o alvo baseado no tempo restante
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
  const m = Math.floor(tempoRestante / 60).toString().padStart(2, '0');
  const s = (tempoRestante % 60).toString().padStart(2, '0');
  document.getElementById("tempo").innerText = `${m}:${s}`;
}

function tocarSom() {
  const audio = document.getElementById("somFim");
  audio.play().catch(e => console.log("Erro áudio:", e));
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

// Hack para destravar áudio no iOS no primeiro toque qualquer
document.body.addEventListener('touchstart', function() {
  const a = document.getElementById("somFim");
  if(a) { a.play().then(() => { a.pause(); a.currentTime=0; }).catch(()=>{}); }
}, {once:true});


function sortearTimes() {
  // 1. Verifica se há jogadores sobrando para sortear
  if (estado.sobrando.length === 0) {
    return alert("Não há jogadores na lista 'Sobrando' para sortear!");
  }

  // 2. Embaralha o array de jogadores sobrando (Algoritmo Fisher-Yates)
  let jogadoresParaSortear = [...estado.sobrando];
  for (let i = jogadoresParaSortear.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [jogadoresParaSortear[i], jogadoresParaSortear[j]] = [jogadoresParaSortear[j], jogadoresParaSortear[i]];
  }

  // 3. Tenta preencher os times que já existem
  // Vamos percorrer os times e ver quem tem espaço (máximo 5)
  estado.times.forEach(time => {
    while (time.jogadores.length < 5 && jogadoresParaSortear.length > 0) {
      const jogadorSorteado = jogadoresParaSortear.shift(); // Tira o primeiro do sorteio
      time.jogadores.push(jogadorSorteado);
    }
  });

  // 4. Se ainda sobrou gente no sorteio, eles voltam para o 'sobrando'
  // Mas agora já estão embaralhados (o que é bom para a próxima chamada)
  estado.sobrando = jogadoresParaSortear;

  // 5. Atualiza a tela e salva
  renderizar();
  alert("Times sorteados com sucesso! 🎲");
}

// INICIALIZAÇÃO
renderizar();