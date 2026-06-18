// Portal da Climatizacao Escolar - Fortaleza
// Camada 1 (mapa) + Camada 2 (ficha da escola)

const DOTCOL = { clim:"#3F9A52", parc:"#6FB97C", pipeline:"#E2A030", iniciar:"#C45C42" };
// cores da rosca: verde/verde-claro institucional; iniciar = terracota (conza -> vermelho)
const ROSCA_COR = { clim:"#3F9A52", parc:"#6FB97C", pipeline:"#E2A030", iniciar:"#C45C42" };
const STCLS  = { clim:"st-clim", parc:"st-parc", pipeline:"st-pipe", iniciar:"st-init" };

const ESCOLAS     = window.ESCOLAS || [];
const DIAGNOSTICO = window.DIAGNOSTICO || {};
const OS          = window.OS || {};
const EXECUCAO    = window.EXECUCAO || {};
const MAPA_SUB    = window.MAPA_SUB || {};   // SGE -> CATEGORIA (subestacao / estudo eletrico)
const LIMITE_DIAS_OS = 15;

function bucket(status) {
  // Regra de agrupamento (nova classificacao da gestao), pelo numero do status:
  //   9 = Climatizada | 10 = Climatizada parcial | 5-8 = Em execucao | 0-4 = A iniciar
  const s = (status || "0. A INICIAR").trim();
  const n = parseInt(s, 10);
  if (n === 9) return "clim";
  if (n === 10) return "parc";
  if (n >= 5 && n <= 8) return "pipeline";   // pipeline = "Em execucao" (status 5-8)
  return "iniciar";                          // status 0-4 (e qualquer fallback) = "A iniciar"
}

// Sala dos professores climatizada (status estrito): retorna o ANO (2025/2026) ou null.
// INSTALADA 2026 -> 2026; CLIMATIZADA (exata) ou INSTALADA 2025 -> 2025. Variantes (insuficiente,
// danificado, sem vida util) NAO contam. Fonte: window.SALAS_PROF (SGE -> "status1||status2").
function salaProfAno(sge) {
  const raw = (window.SALAS_PROF || {})[String(sge)];
  if (!raw) return null;
  const sts = raw.split("||");
  if (sts.includes("INSTALADA 2025")) return "2025";   // instalada em 2025 -> conta em 2025
  // INSTALADA 2026 e CLIMATIZADA (sem ano: descobertas/diagnosticadas em 2026, sem registro
  // anterior) -> contam em 2026.
  if (sts.includes("INSTALADA 2026") || sts.includes("CLIMATIZADA")) return "2026";
  return null;
}

function moeda(v) {
  if (v === null || v === undefined || v === "" || isNaN(v)) return "—";
  return Number(v).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
}
function moeda0(v){ // mostra R$ 0 como tracinho? mantemos 0 quando explicito
  return moeda(v);
}
function data(v){
  if(!v) return "—";
  const s = String(v).split(" ")[0];
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}
function txt(v){ return (v===null||v===undefined||v==="") ? "—" : v; }

// ---------- mapa ----------
// zoomSnap:0 -> permite zoom fracionario, pra o fitBounds encaixar o territorio com a
// folga real do padding (com o snap=1 padrao o zoom travava no nivel inteiro e o
// territorio nao crescia mesmo reduzindo o padding). zoomDelta:1 mantem o passo dos botoes +/-.
const map = L.map("map", { scrollWheelZoom: false, zoomSnap: 0, zoomDelta: 1 }).setView([-3.768, -38.545], 11.4);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  maxZoom: 19, subdomains: "abcd",
  attribution: "&copy; OpenStreetMap &copy; CARTO"
}).addTo(map);
const layer = L.layerGroup().addTo(map);

// ---------- camadas de areas (distritos / regionais) ----------
// panes proprios, abaixo dos pontos e sem capturar cliques (pra nao bloquear as escolas)
map.createPane("paneDistritos");
map.getPane("paneDistritos").style.zIndex = 350;          // overlayPane (pontos) = 400
map.getPane("paneDistritos").style.pointerEvents = "auto"; // distritos clicaveis (drill); pontos ficam acima, no pane 400
map.createPane("paneRegionais");
map.getPane("paneRegionais").style.zIndex = 351;           // acima do frame do distrito (350), abaixo dos pontos (400)
map.getPane("paneRegionais").style.pointerEvents = "auto"; // regionais clicaveis no nivel 1 do drill
map.createPane("paneBairros");
map.getPane("paneBairros").style.zIndex = 352;           // acima das regionais (351), abaixo dos pontos (400)
map.getPane("paneBairros").style.pointerEvents = "auto"; // bairros clicaveis no nivel 2 do drill

const distritosLayer = L.geoJSON(window.DISTRITOS || null, {
  pane: "paneDistritos",
  style: f => ({
    // borda escura e marcada pra destacar o contorno sobre o fundo claro;
    // preenchimento segue na cor do distrito, semitransparente
    color: "#2A2A2A", weight: 2.7, opacity: .9,
    fillColor: f.properties.cor, fillOpacity: .18
  }),
  onEachFeature: (f, l) => {
    // clicar num distrito => drill (zoom + foca + filtra). entraDistrito e hoisted.
    l.on("click", () => entraDistrito(f.properties.num));
  }
});
const regionaisLayer = L.geoJSON(window.REGIONAIS || null, {
  pane: "paneRegionais",
  style: f => ({
    color: f.properties.cor, weight: 1.2, opacity: .85,
    fillColor: f.properties.cor, fillOpacity: .40
  }),
  onEachFeature: (f, l) => {
    // clicar numa regional => drill nivel 2. entraRegional e hoisted.
    l.on("click", () => entraRegional(f.properties.num));
  }
});
const bairrosLayer = L.geoJSON(window.BAIRROS_AREAS || null, {
  pane: "paneBairros",
  style: f => ({
    color: f.properties.cor, weight: .8, opacity: .85,
    fillColor: f.properties.cor, fillOpacity: .40
  }),
  onEachFeature: (f, l) => {
    // clicar num bairro => drill nivel 3. entraBairro e hoisted.
    l.on("click", () => entraBairro(f.properties.key));
  }
});

// ---------- navegacao por niveis (drill-down) ----------
// indexa as sublayers por numero, pra focar/ocultar individualmente
const distritoSubs = {};
distritosLayer.eachLayer(l => { distritoSubs[String(l.feature.properties.num)] = l; });
const regionaisSubs = {};
regionaisLayer.eachLayer(l => { regionaisSubs[String(l.feature.properties.num)] = l; });

// bairros indexados por KEY normalizada (o 'key' do geojson vem sem acento;
// ESCOLAS.bairro mantem acento, entao o join e por forma normalizada).
// Populados em montaDrill() porque dependem de normaliza() (que so existe apos o TDZ).
let bairrosSubs = {};          // norm(key) -> sublayer
const BAIRRO_REAL = {};        // norm(bairro) -> texto real do campo BAIRRO (com acento), pro filtro

let drillModo = "distritos";   // por enquanto so o modo Distritos esta implementado
let drillDistrito = null;      // null = nivel 0 (Fortaleza); num = distrito focado
let drillRegional = null;      // null = nivel 1; num = regional focada (nivel 2)
let drillBairro = null;        // null = nivel 2; norm(key) = bairro focado (nivel 3)
let rotulos = [];              // tooltips permanentes com o nome do territorio (distrito/regional/bairro)
const VIEW0 = { center: [-3.768, -38.545], zoom: 11.4 };
const FIT_PAD = [14, 14];   // folga (px) na borda do fitBounds: respiro leve pra o territorio ficar grande sem cortar a borda

// mostra so o distrito focado: removemos as outras sublayers do grupo
// (remover, e nao so esconder, garante que elas nao capturem cliques)
function focaDistritoNoMapa(num) {
  for (const [k, l] of Object.entries(distritoSubs)) {
    const querMostrar = (num == null) || (k === String(num));
    const estaNoMapa = distritosLayer.hasLayer(l);
    if (querMostrar && !estaNoMapa) distritosLayer.addLayer(l);
    else if (!querMostrar && estaNoMapa) distritosLayer.removeLayer(l);
  }
}

// esconde todos os distritos (usado no nivel 2: ao focar uma regional, some o frame do distrito
// pra ficar visivel so a regional, e nao a area do distrito inteiro/da regional irma)
function escondeTodosDistritos() {
  for (const l of Object.values(distritoSubs))
    if (distritosLayer.hasLayer(l)) distritosLayer.removeLayer(l);
}

// mostra todas as 12 regionais (nivel 0 do modo "regionais")
function mostraTodasRegionais() {
  for (const l of Object.values(regionaisSubs))
    if (!regionaisLayer.hasLayer(l)) regionaisLayer.addLayer(l);
}

// mostra as regionais de um distrito; se focoRegional setado, so essa.
// distNum null => remove todas (nivel 0).
function setRegionaisDoDistrito(distNum, focoRegional) {
  for (const [k, l] of Object.entries(regionaisSubs)) {
    const pertence = String(l.feature.properties.distrito) === String(distNum);
    const querMostrar = (distNum != null) && pertence &&
                        (focoRegional == null || k === String(focoRegional));
    const esta = regionaisLayer.hasLayer(l);
    if (querMostrar && !esta) regionaisLayer.addLayer(l);
    else if (!querMostrar && esta) regionaisLayer.removeLayer(l);
  }
}

// conjunto de bairros (forma normalizada) que tem escola numa regional.
// usa o join autoritativo key<->BAIRRO via as proprias escolas (o campo 'regional'
// do bairros.geojson nao cobre as 12 regionais, entao derivamos das escolas).
function bairrosDaRegional(regionalNum) {
  const set = new Set();
  for (const e of ESCOLAS)
    if (String(e.regional) === String(regionalNum)) set.add(aliasBairro(normaliza(e.bairro)));
  return set;
}

// mostra os bairros de uma regional; se focoNormKey setado, so esse.
// regionalNum null => remove todos (niveis 0 e 1).
function setBairrosDaRegional(regionalNum, focoNormKey) {
  const permitidos = (regionalNum == null) ? new Set() : bairrosDaRegional(regionalNum);
  for (const [nk, l] of Object.entries(bairrosSubs)) {
    const querMostrar = permitidos.has(nk) && (focoNormKey == null || nk === focoNormKey);
    const esta = bairrosLayer.hasLayer(l);
    if (querMostrar && !esta) bairrosLayer.addLayer(l);
    else if (!querMostrar && esta) bairrosLayer.removeLayer(l);
  }
}

function nomeDistrito(num) {
  const s = distritoSubs[String(num)];
  return s ? s.feature.properties.nome : ("Distrito " + num);
}
function nomeRegional(num) {
  const s = regionaisSubs[String(num)];
  return s ? s.feature.properties.nome : ("SER " + num);
}
function nomeBairro(nk) {
  const s = bairrosSubs[nk];
  return s ? s.feature.properties.nome : (BAIRRO_REAL[nk] || nk);
}

// mantem os chips de regional (filtro existente) em sincronia com o drill
function setChipRegional(valor) {
  document.querySelectorAll("#f-regional button").forEach(b =>
    b.classList.toggle("on", b.dataset.r === valor));
}

// ---- nivel 1: um distrito (mostra suas 2 regionais, filtra as escolas do distrito) ----
function entraDistrito(num) {
  // ja no nivel 1 desse distrito? nao faz nada. (se estiver no nivel 2, volta pro nivel 1.)
  if (drillDistrito !== null && String(drillDistrito) === String(num) && drillRegional == null) return;
  drillDistrito = num;
  drillRegional = null;
  drillBairro = null;
  focaDistritoNoMapa(num);
  setRegionaisDoDistrito(num, null);      // revela as 2 regionais do distrito (clicaveis)
  setBairrosDaRegional(null);             // sem bairros no nivel 1
  const sub = distritoSubs[String(num)];
  if (sub) map.fitBounds(sub.getBounds(), { padding: FIT_PAD });
  // reusa o filtro existente: sel-distrito alimenta passaFiltroGeo (mapa+lista+funil).
  // ESCOLAS.distrito usa o numeral romano (I..VI), que e a propriedade 'romano' do poligono.
  document.getElementById("sel-distrito").value = sub ? sub.feature.properties.romano : "";
  document.getElementById("sel-bairro").value = "";
  regionalAtiva = "all";
  setChipRegional("all");
  aplicaFiltros();
  renderTrilha();
}

// ---- nivel 2: uma regional (mostra so ela, filtra as escolas da regional) ----
function entraRegional(num) {
  if (drillRegional !== null && String(drillRegional) === String(num)) return; // ja focada
  const sub = regionaisSubs[String(num)];
  if (!sub) return;
  const distPai = sub.feature.properties.distrito;
  if (drillModo === "distritos") {
    // no modo distritos a trilha passa pelo distrito-pai; garante que ele esteja setado
    if (drillDistrito === null || String(drillDistrito) !== String(distPai)) {
      drillDistrito = distPai;
      const dsub = distritoSubs[String(distPai)];
      document.getElementById("sel-distrito").value = dsub ? dsub.feature.properties.romano : "";
    }
  } else {
    // modo regionais: pula o distrito (a trilha vai direto Fortaleza > Regional)
    drillDistrito = null;
    document.getElementById("sel-distrito").value = "";
  }
  drillRegional = num;
  drillBairro = null;
  escondeTodosDistritos();                // some o frame do distrito: fica visivel so a regional
  setRegionaisDoDistrito(distPai, num);   // mostra so a regional escolhida (as outras somem)
  setBairrosDaRegional(num, null);        // revela os bairros da regional (clicaveis)
  map.fitBounds(sub.getBounds(), { padding: FIT_PAD });
  // reusa o filtro de regional existente (regionalAtiva alimenta passaFiltroGeo)
  regionalAtiva = String(num);
  setChipRegional(String(num));
  document.getElementById("sel-bairro").value = "";
  aplicaFiltros();
  renderTrilha();
}

// ---- nivel 3: um bairro (mostra so ele, filtra as escolas do bairro) ----
function entraBairro(rawKey) {
  const nk = aliasBairro(normaliza(rawKey));
  if (drillBairro !== null && drillBairro === nk) return; // ja focado
  const sub = bairrosSubs[nk];
  if (!sub) return;
  drillBairro = nk;
  setBairrosDaRegional(drillRegional, nk);   // mostra so o bairro escolhido
  map.fitBounds(sub.getBounds(), { padding: FIT_PAD });
  // reusa o filtro de bairro existente: sel-bairro guarda o texto real (com acento) do campo BAIRRO
  document.getElementById("sel-bairro").value = BAIRRO_REAL[nk] || "";
  aplicaFiltros();
  renderTrilha();
}

// volta do nivel 3 pro nivel 2 (regional)
function voltaNivelRegional() {
  if (drillRegional == null) return;
  drillBairro = null;
  setBairrosDaRegional(drillRegional, null);   // mostra os bairros da regional de novo
  document.getElementById("sel-bairro").value = "";
  const rsub = regionaisSubs[String(drillRegional)];
  if (rsub) map.fitBounds(rsub.getBounds(), { padding: FIT_PAD });
  aplicaFiltros();
  renderTrilha();
}

// volta do nivel 2 pro nivel 1 (distrito)
function voltaNivelDistrito() {
  if (drillDistrito == null) return;
  drillRegional = null;
  drillBairro = null;
  focaDistritoNoMapa(drillDistrito);             // restaura o frame do distrito (escondido no nivel 2)
  setRegionaisDoDistrito(drillDistrito, null);   // mostra as 2 regionais de novo
  setBairrosDaRegional(null);                    // some com os bairros
  regionalAtiva = "all";
  setChipRegional("all");
  document.getElementById("sel-bairro").value = "";
  const dsub = distritoSubs[String(drillDistrito)];
  if (dsub) map.fitBounds(dsub.getBounds(), { padding: FIT_PAD });
  aplicaFiltros();
  renderTrilha();
}

// volta pro nivel 0 (Fortaleza inteira)
function voltaNivel0() {
  drillDistrito = null;
  drillRegional = null;
  drillBairro = null;
  setBairrosDaRegional(null);            // some com os bairros
  if (drillModo === "regionais") {
    escondeTodosDistritos();             // modo regionais: nivel 0 mostra as 12 regionais
    mostraTodasRegionais();
  } else {
    focaDistritoNoMapa(null);            // modo distritos: nivel 0 mostra os 6 distritos
    setRegionaisDoDistrito(null);
  }
  map.setView(VIEW0.center, VIEW0.zoom);
  document.getElementById("sel-distrito").value = "";  // todas as 512 escolas
  document.getElementById("sel-bairro").value = "";
  regionalAtiva = "all";
  setChipRegional("all");
  aplicaFiltros();
  renderTrilha();
}

function renderTrilha() {
  const tr = document.getElementById("drill-trilha");
  if (!tr) return;
  // icone de casa no inicio do breadcrumb (herda a cor do crumb: azul no link, escuro no atual)
  const casa = `<svg class="crumb-casa" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>`;
  const forta = `<a class="crumb link" id="crumb-forta">${casa}Fortaleza</a>`;
  const fortaAtual = `<span class="crumb atual">${casa}Fortaleza</span>`;
  const sep = `<span class="sep">›</span>`;
  const atual = t => `<span class="crumb atual">${t}</span>`;
  const linkDist = `<a class="crumb link" id="crumb-dist">${nomeDistrito(drillDistrito)}</a>`;
  const linkReg = `<a class="crumb link" id="crumb-reg">${nomeRegional(drillRegional)}</a>`;
  let html;
  if (drillModo === "regionais") {
    // trilha sem distrito: Fortaleza > Regional > Bairro
    if (drillRegional == null) html = fortaAtual;
    else if (drillBairro == null) html = forta + sep + atual(nomeRegional(drillRegional));
    else html = forta + sep + linkReg + sep + atual(nomeBairro(drillBairro));
  } else {
    // trilha com distrito: Fortaleza > Distrito > Regional > Bairro
    if (drillDistrito == null) html = fortaAtual;
    else if (drillRegional == null) html = forta + sep + atual(nomeDistrito(drillDistrito));
    else if (drillBairro == null) html = forta + sep + linkDist + sep + atual(nomeRegional(drillRegional));
    else html = forta + sep + linkDist + sep + linkReg + sep + atual(nomeBairro(drillBairro));
  }
  tr.innerHTML = html;
  const cf = document.getElementById("crumb-forta"); if (cf) cf.onclick = voltaNivel0;
  const cd = document.getElementById("crumb-dist");  if (cd) cd.onclick = voltaNivelDistrito;
  const cr = document.getElementById("crumb-reg");   if (cr) cr.onclick = voltaNivelRegional;
  // seta de voltar: desabilitada no nivel 0 (Fortaleza)
  const voltar = document.getElementById("drill-voltar");
  if (voltar) voltar.disabled = (drillDistrito == null && drillRegional == null && drillBairro == null);
  renderRotulos();   // os rotulos acompanham o nivel atual do drill
  renderBotoes();    // os botoes de selecao acompanham o nivel atual do drill
}

// ---------- rotulos dos territorios (nomes sobre as areas) ----------
function limpaRotulos() {
  for (const t of rotulos) map.removeLayer(t);
  rotulos = [];
}
function addRotulo(center, texto) {
  const t = L.tooltip({ permanent: true, direction: "center", className: "rotulo-territorio",
                        interactive: false, opacity: 1 })
    .setLatLng(center).setContent(String(texto));
  t.addTo(map);
  rotulos.push(t);
}
// rotulos acompanham o nivel: bairro focado / regional focada / 2 regionais do distrito /
// nivel 0 (6 distritos no modo distritos, ou 12 regionais no modo regionais)
function renderRotulos() {
  limpaRotulos();
  if (drillBairro != null) {
    const s = bairrosSubs[drillBairro];
    if (s) addRotulo(s.getBounds().getCenter(), s.feature.properties.nome);
  } else if (drillRegional != null) {
    const s = regionaisSubs[String(drillRegional)];
    if (s) addRotulo(s.getBounds().getCenter(), s.feature.properties.nome);
  } else if (drillDistrito != null) {
    regionaisLayer.eachLayer(l => addRotulo(l.getBounds().getCenter(), l.feature.properties.nome));
  } else if (drillModo === "regionais") {
    regionaisLayer.eachLayer(l => addRotulo(l.getBounds().getCenter(), l.feature.properties.nome));
  } else {
    distritosLayer.eachLayer(l => addRotulo(l.getBounds().getCenter(), l.feature.properties.nome));
  }
}

// ---------- botoes de selecao (mesmo efeito de clicar no mapa), acompanham o nivel ----------
function renderBotoes() {
  const box = document.getElementById("drill-botoes");
  if (!box) return;
  let itens = [];   // {label, ativo, fn}
  if (drillRegional != null) {
    // dentro de uma regional (qualquer modo): botoes dos bairros dela
    const arr = [];
    for (const nk of bairrosDaRegional(drillRegional)) {
      const s = bairrosSubs[nk];
      if (s) arr.push({ nk, nome: s.feature.properties.nome, key: s.feature.properties.key });
    }
    arr.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    itens = arr.map(it => ({ label: it.nome, ativo: drillBairro === it.nk, fn: () => entraBairro(it.key) }));
  } else if (drillDistrito != null) {
    // dentro de um distrito (modo distritos): botoes das 2 regionais dele
    const arr = [];
    regionaisLayer.eachLayer(l => arr.push({ num: l.feature.properties.num, nome: l.feature.properties.nome }));
    arr.sort((a, b) => a.num - b.num);
    itens = arr.map(it => ({ label: it.nome, ativo: false, fn: () => entraRegional(it.num) }));
  } else if (drillModo === "regionais") {
    // nivel 0 do modo regionais: R1..R12
    const arr = Object.values(regionaisSubs).map(l => ({ num: l.feature.properties.num }));
    arr.sort((a, b) => a.num - b.num);
    itens = arr.map(it => ({ label: "R" + it.num, ativo: false, fn: () => entraRegional(it.num) }));
  } else {
    // nivel 0 do modo distritos: os 6 distritos
    const arr = Object.values(distritoSubs).map(l => ({ num: l.feature.properties.num, nome: l.feature.properties.nome }));
    arr.sort((a, b) => a.num - b.num);
    itens = arr.map(it => ({ label: it.nome, ativo: false, fn: () => entraDistrito(it.num) }));
  }
  box.innerHTML = itens.map((it, i) => `<button class="db${it.ativo ? " on" : ""}" data-i="${i}">${it.label}</button>`).join("");
  [...box.querySelectorAll("button")].forEach((btn, i) => { btn.onclick = itens[i].fn; });
}

// troca o modo de entrada (Distritos | Regionais) e volta pro nivel 0 do modo
function trocaModo(modo) {
  if (drillModo === modo) return;
  drillModo = modo;
  document.querySelectorAll(".mapnav .dm").forEach(b =>
    b.classList.toggle("on", b.dataset.modo === modo));
  voltaNivel0();   // reseta pro nivel 0, que ja e ciente do modo
}

// sobe um nivel (mesmo efeito de clicar no degrau anterior da trilha)
function voltaUmNivel() {
  if (drillBairro != null) voltaNivelRegional();
  else if (drillRegional != null) (drillModo === "distritos") ? voltaNivelDistrito() : voltaNivel0();
  else if (drillDistrito != null) voltaNivel0();
  // nivel 0: nada (a seta fica desabilitada)
}

function montaDrill() {
  // A faixa de navegacao agora vive no DOM da pagina (acima do mapa), nao mais como
  // controle flutuante do Leaflet. Aqui so indexamos os bairros e ligamos os eventos.
  // indexa bairros por key normalizada e monta o mapa norm(bairro)->texto real (com acento).
  // feito aqui (e nao no topo) porque depende de normaliza(), que usa um const em TDZ.
  bairrosLayer.eachLayer(l => { bairrosSubs[aliasBairro(normaliza(l.feature.properties.key))] = l; });
  ESCOLAS.forEach(e => { if (e.bairro != null) BAIRRO_REAL[aliasBairro(normaliza(e.bairro))] = e.bairro; });

  // os dois caminhos de "Ver por" (Distritos | Regionais) trocam o modo de entrada
  document.querySelectorAll(".mapnav .dm").forEach(b =>
    b.addEventListener("click", () => trocaModo(b.dataset.modo)));
  // seta de voltar um nivel
  document.getElementById("drill-voltar").addEventListener("click", voltaUmNivel);

  distritosLayer.addTo(map);     // nivel 0 (modo distritos): os 6 distritos visiveis
  setRegionaisDoDistrito(null);  // garante nenhuma regional no nivel 0
  regionaisLayer.addTo(map);     // grupo no mapa, mas vazio ate drillar
  setBairrosDaRegional(null);    // garante nenhum bairro no nivel 0
  bairrosLayer.addTo(map);       // grupo no mapa, mas vazio ate drillar numa regional
  renderTrilha();                // monta trilha + rotulos + botoes do nivel 0
}

let TODAS = [], SEM_COORD = [];
let nGeo = 0, nCentroide = 0;

function jitter(base, i, total) {
  if (total <= 1) return base;
  const raio = 0.0042;
  const ang = (2 * Math.PI * i) / total;
  const r = raio * (0.35 + 0.65 * ((i % 3) / 2));
  return [base[0] + r * Math.cos(ang), base[1] + r * Math.sin(ang) * 0.85];
}

function preparaCoordenadas(escolas) {
  const semCoord = [];
  for (const e of escolas) {
    if (typeof e.lat === "number" && typeof e.lng === "number") {
      e._latlng = [e.lat, e.lng]; e._fonte = "geocode"; TODAS.push(e); nGeo++;
    } else {
      semCoord.push(e);
    }
  }
  // fallback: centroide de bairro com dispersao
  const porBairro = {};
  for (const e of semCoord) (porBairro[e.bairro] = porBairro[e.bairro] || []).push(e);
  for (const [bairro, lista] of Object.entries(porBairro)) {
    const base = window.BAIRRO_CENTROIDES[bairro];
    if (!base) { SEM_COORD.push(...lista); continue; }
    lista.forEach((e, i) => { e._latlng = jitter(base, i, lista.length); e._fonte = "centroide"; TODAS.push(e); nCentroide++; });
  }
}

let regionalAtiva = "all";

function montaChipsRegional(escolas) {
  const regs = ["all", ...[...new Set(escolas.map(e => e.regional))]
    .filter(r => r !== null && r !== undefined)
    .sort((a, b) => Number(a) - Number(b))];
  const box = document.getElementById("f-regional");
  box.innerHTML = regs.map((r, i) =>
    `<button class="${i === 0 ? "on" : ""}" data-r="${r}">${r === "all" ? "Todas" : "R" + r}</button>`
  ).join("");
  box.querySelectorAll("button").forEach(b => b.onclick = () => {
    box.querySelectorAll("button").forEach(x => x.classList.remove("on"));
    b.classList.add("on"); regionalAtiva = b.dataset.r; aplicaFiltros();
  });
}

function preencheSelect(id, valores) {
  const sel = document.getElementById(id);
  [...valores].filter(v => v !== null && v !== undefined && v !== "")
    .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"))
    .forEach(v => { const o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o); });
}

// recorte geografico: regional + distrito + bairro (usado pelo panorama/funil)
function passaFiltroGeo(e) {
  const fd = document.getElementById("sel-distrito").value;
  const fb = document.getElementById("sel-bairro").value;
  if (regionalAtiva !== "all" && String(e.regional) !== regionalAtiva) return false;
  if (fd && String(e.distrito) !== fd) return false;
  if (fb && e.bairro !== fb) return false;
  return true;
}

// ---------- filtro de periodo por ano (derivado da ETAPA da execucao) ----------
// Periodo de cada unidade: ETAPA 01 -> "2025", ETAPA 02 -> "2026". Climatizada/parcial
// sem execucao em 2025/2026 -> "antes" (antes de 2025). As demais (sem execucao e nao
// climatizadas) sao as a iniciar futuras, planejadas -> "2027/2028". Regra geral: a unidade
// pertence ao ANO EM QUE A CLIMATIZACAO COMECOU; entao quem tem 01 e 02 conta no mais
// antigo (2025). Assim todas as 512 tem periodo. PERIODO[sge] e calculado uma vez em montaPeriodos().
let periodoAtivo = "all";
// grupo do funil (bucket) ativo: null | "iniciar" | "pipeline" | "parc" | "clim".
// Filtra mapa/lista por bucket. Hoje so o dropdown "Status geral" usa isso; o FUNIL nao filtra mais.
let funilBucket = null;
// faixa do funil com a lista de unidades aberta (expandida). NAO filtra o mapa, so mostra a lista.
let funilExpandido = null;
const PERIODO = {};
function periodoDaEscola(e) {
  const arr = EXECUCAO[e.sge] || [];
  const has01 = arr.some(x => String(x.etapa || "").trim().toUpperCase().startsWith("ETAPA 01"));
  const has02 = arr.some(x => String(x.etapa || "").trim().toUpperCase().startsWith("ETAPA 02"));
  if (has01) return "2025";   // tem 01 (mesmo que tambem tenha 02): ano em que comecou
  if (has02) return "2026";
  const b = bucket(e.status);
  if (b === "clim" || b === "parc") return "antes";   // climatizada/parcial sem exec 25/26
  return "2027/2028";                                  // a iniciar futuras (planejadas)
}
function montaPeriodos() { for (const e of ESCOLAS) PERIODO[e.sge] = periodoDaEscola(e); }
function passaPeriodo(e) {
  if (periodoAtivo === "all") return true;
  return PERIODO[e.sge] === periodoAtivo;
}

// predicado compartilhado entre mapa e lista (geografico + status + periodo; a busca textual e so da lista)
function passaFiltro(e) {
  if (!passaFiltroGeo(e)) return false;
  // Status geral (dropdown) filtra por grupo (funilBucket): A iniciar (0-4) / Em execucao (5-8) /
  // Climatizada parcial (10) / Climatizada (9). O funil NAO filtra mais (so abre a lista).
  if (funilBucket && bucket(e.status) !== funilBucket) return false;   // grupo do dropdown Status geral
  if (!passaPeriodo(e)) return false;
  return true;
}

function aplicaFiltros() {
  layer.clearLayers();
  let n = 0;
  for (const e of TODAS) {
    if (!passaFiltro(e)) continue;
    const m = L.circleMarker(e._latlng, {
      radius: 5, weight: 1.4, color: "rgba(0,0,0,.35)",
      fillColor: DOTCOL[bucket(e.status)], fillOpacity: .9
    });
    m.on("click", () => abreFicha(e.sge));
    m.bindTooltip(`${e.nome}`, { direction: "top", offset: [0, -4] });
    layer.addLayer(m);
    n++;
  }
  document.getElementById("contagem").textContent = n;
  renderLista();
  funilExpandido = null;   // qualquer mudanca de recorte (drill/periodo/status) fecha a lista do funil
  renderPanorama();
  renderPainelContexto();
  renderMapaSub();   // 2o mapa (subestacao) acompanha territorio + periodo
}

// ---------- painel de contexto do territorio (esquerda do mapa) ----------
// Recalcula a partir do recorte geografico atual do drill (passaFiltroGeo, sem o filtro de
// status) — o mesmo recorte que move mapa/lista/funil. NAO se mistura com a ficha da ESCOLA.
const PARQUE_ESCOLAS = 512;
const PARQUE_SALAS = 5518;
// verba total do parque = soma de VALOR TOTAL GASTO (EXECUCAO) de todas as escolas
const PARQUE_VERBA = (() => {
  let t = 0;
  for (const k in EXECUCAO) for (const x of EXECUCAO[k]) if (typeof x.totalGasto === "number") t += x.totalGasto;
  return t;
})();

function territorioAtual() {
  if (drillBairro != null)   return nomeBairro(drillBairro);
  if (drillRegional != null) return nomeRegional(drillRegional);
  if (drillDistrito != null) return nomeDistrito(drillDistrito);
  return "Fortaleza";
}
function pctNum(n, total) { return total ? Math.min(100, (n / total) * 100) : 0; }
function fmtPct(n, total) { return total ? (Math.round((n / total) * 1000) / 10).toLocaleString("pt-BR") : "0"; }
// valor monetario compacto para o numero grande dos cartoes (R$ 1,7 mi / R$ 320 mil)
function moedaCompacta(v) {
  if (v == null || isNaN(v) || !isFinite(v)) return "—";
  const n = Number(v);
  if (n >= 1e6) return "R$ " + (n / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " mi";
  if (n >= 1e3) return "R$ " + Math.round(n / 1e3).toLocaleString("pt-BR") + " mil";
  return moeda(n);
}

// anima um numero SO quando o valor muda entre renders (troca de territorio/periodo). Retorna
// o sufixo de classe " num-anim" quando mudou; no 1o render (sem valor anterior) nao anima.
const PREV_NUM = {};
function numAnim(key, val) {
  const mudou = (key in PREV_NUM) && PREV_NUM[key] !== val;
  PREV_NUM[key] = val;
  return mudou ? " num-anim" : "";
}

function renderPainelContexto() {
  const body = document.getElementById("ctx-body");
  if (!body) return;
  // ordem dos periodos como SEQUENCIA (antes -> 2025 -> 2026 -> 2027/2028). O periodo selecionado
  // e um corte ACUMULADO: tudo ATE ele entra. Em "Todos" = parque inteiro.
  const ordPer = { "antes": 0, "2025": 1, "2026": 2, "2027/2028": 3 };
  const cutoff = (periodoAtivo === "all") ? Infinity : (ordPer[periodoAtivo] ?? Infinity);
  const atePeriodo = e => (ordPer[PERIODO[e.sge]] ?? Infinity) <= cutoff;
  // recorte FILTRADO (territorio + Status geral + funil + periodo ACUMULADO): alimenta os NUMEROS
  // (Tamanho e o balao de indicadores). O periodo aqui ACUMULA (igual a rosca): 2025 = antes+2025,
  // 2026 = antes+2025+2026... — diferente do mapa/lista, que mostram so o periodo exato.
  const base = ESCOLAS.filter(e =>
    passaFiltroGeo(e)
    && (!funilBucket || bucket(e.status) === funilBucket)   // Status geral/funil = grupo (funilBucket)
    && atePeriodo(e));
  // recorte so do TERRITORIO (geo): alimenta a rosca de avanco e a linha do tempo.
  const baseGeo = ESCOLAS.filter(passaFiltroGeo);

  // NUMEROS do bloco TAMANHO (salas do recorte filtrado). Maquinas/investimento/cobertura/tipo
  // sao do BALAO, calculados mais abaixo a partir do recorte territorio+periodo (igual a rosca).
  let nSalas = 0;
  for (const e of base) nSalas += Number(e.salas) || 0;
  const nEsc = base.length;

  // ROSCA/LEGENDA (avanco ACUMULADO por periodo): quanto do territorio ja esta climatizado/parcial
  // ATE o periodo selecionado, como sequencia (antes de 2025 -> +2025 -> +2026 -> 2027/2028 nao
  // acrescenta nada ainda). Proporcional ao total do territorio (nEscGeo). O Status NAO entra na
  // rosca. Em "Todos" = acumulado total do territorio (mesmo numero do panorama).
  let nClim = 0, nParc = 0;
  for (const e of baseGeo) {
    const bk = bucket(e.status);
    if (bk !== "clim" && bk !== "parc") continue;
    if ((ordPer[PERIODO[e.sge]] ?? Infinity) <= cutoff) { if (bk === "clim") nClim++; else nParc++; }
  }
  const nEscGeo = baseGeo.length;
  const nPipe = baseGeo.filter(e => bucket(e.status) === "pipeline").length;
  const nInic = nEscGeo - nClim - nParc - nPipe;

  // LINHA DO TEMPO: composicao por periodo do territorio (so geo, pra nao degenerar a 1 barra
  // quando o periodo esta filtrado).
  let nAntes = 0, nP2025 = 0, nP2026 = 0, n26pronta = 0, n26proc = 0, n26init = 0;
  for (const e of baseGeo) {
    const per = PERIODO[e.sge], bk = bucket(e.status);
    if (per === "antes") nAntes++;
    else if (per === "2025") nP2025++;
    else if (per === "2026") {
      nP2026++;
      if (bk === "clim" || bk === "parc") n26pronta++;   // pronta
      else if (bk === "iniciar") n26init++;              // a iniciar
      else n26proc++;                                    // em processo (etapas do meio)
    }
  }
  document.getElementById("ctx-nome").textContent = territorioAtual();

  // bloco TAMANHO: escolas e salas, cada um com % do parque + barra
  const barra = (lab, val, pct) =>
    `<div class="ctx-metric">
       <div class="ctx-mrow"><span class="ctx-mlab">${lab}</span>` +
       `<span class="ctx-mval${numAnim("tam-" + lab, val)}">${val.toLocaleString("pt-BR")}</span>` +
       `<span class="ctx-mpct">${fmtPct(val, lab === "Unidades" ? PARQUE_ESCOLAS : PARQUE_SALAS)}% do parque</span></div>` +
       `<div class="ctx-bar"><span style="width:${pct.toFixed(1)}%"></span></div>
     </div>`;
  const tamanho =
    `<section class="ctx-block">
       <div class="ctx-tit">Tamanho</div>
       ${barra("Unidades", nEsc, pctNum(nEsc, PARQUE_ESCOLAS))}
       ${barra("Salas", nSalas, pctNum(nSalas, PARQUE_SALAS))}
     </section>`;

  // bloco AVANCO: rosca de 3 status + legenda; e a EQUIDADE logo abaixo da rosca
  const segs = [
    { lab: "Climatizada",  v: nClim, cor: ROSCA_COR.clim },
    { lab: "Parcial",      v: nParc, cor: ROSCA_COR.parc },
    { lab: "Em execução",  v: nPipe, cor: ROSCA_COR.pipeline },
    { lab: "A iniciar",    v: nInic, cor: ROSCA_COR.iniciar }
  ];
  const R = 40, W = 15, C = 2 * Math.PI * R;
  let acc = 0;
  const arcos = segs.map(s => {
    if (!s.v || !nEscGeo) return "";
    const f = s.v / nEscGeo;
    const rot = acc * 360 - 90; acc += f;
    return `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${s.cor}" stroke-width="${W}" ` +
           `stroke-dasharray="${(f * C).toFixed(2)} ${C.toFixed(2)}" transform="rotate(${rot.toFixed(2)} 50 50)"/>`;
  }).join("");
  // centro da rosca: soma de climatizadas (status 9) + parciais (status 10) = total onde
  // houve intervencao, recalculado por territorio (Fortaleza = 32,4% = 29,3 + 3,1).
  const centro = nEscGeo ? `${fmtPct(nClim + nParc, nEscGeo)}%` : "—";
  const donut =
    `<svg class="ctx-donut" viewBox="0 0 100 100" role="img" aria-label="Avanço da climatização">
       <circle cx="50" cy="50" r="${R}" fill="none" stroke="#EDEAE2" stroke-width="${W}"/>
       ${arcos}
       <text x="50" y="55" text-anchor="middle" class="ctx-donut-num${numAnim("avanco-centro", centro)}" font-size="16">${centro}</text>
     </svg>`;
  const legenda = segs.map(s =>
    `<li><i style="background:${s.cor}"></i><span class="ll">${s.lab}</span><b>${s.v}</b>` +
    `<span class="lp">${fmtPct(s.v, nEscGeo)}%</span></li>`).join("");

  const avanco =
    `<section class="ctx-block">
       <div class="ctx-tit">Avanço</div>
       <div class="ctx-donut-wrap">${donut}<ul class="ctx-leg">${legenda}</ul></div>
     </section>`;

  // bloco LINHA DO TEMPO: 3 barras por periodo, comprimento proporcional (escala pela maior),
  // cada uma na cor de periodo padronizada (antes=cinza / 2025=verde / 2026=azul).
  const tlMax = Math.max(1, nAntes, nP2025, nP2026);
  const tlW = n => (n / tlMax * 100).toFixed(1);
  const linhaTempo =
    `<section class="ctx-block">
       <div class="ctx-tit">Linha do tempo</div>
       <div class="tl">
         <div class="tl-row"><span class="tl-lab">Antes de 2025</span>
           <span class="tl-bar tl-antes"><span class="tl-seg" style="width:${tlW(nAntes)}%"></span></span>
           <span class="tl-num${numAnim("tl-antes", nAntes)}">${nAntes}</span></div>
         <div class="tl-row"><span class="tl-lab">2025</span>
           <span class="tl-bar tl-2025"><span class="tl-seg" style="width:${tlW(nP2025)}%"></span></span>
           <span class="tl-num${numAnim("tl-2025", nP2025)}">${nP2025}</span></div>
         <div class="tl-row"><span class="tl-lab">2026</span>
           <span class="tl-bar tl-2026"><span class="tl-seg" style="width:${tlW(nP2026)}%"></span></span>
           <span class="tl-num${numAnim("tl-2026", nP2026)}">${nP2026}</span></div>
       </div>
     </section>`;

  // painel da ESQUERDA: Tamanho + Avanço + Linha do tempo
  body.innerHTML = tamanho + avanco + linhaTempo;

  // ---- BALAO UNICO de indicadores embaixo do mapa: 4 secoes lado a lado ----
  // Recorte do BALAO = territorio + periodo ACUMULADO, SEM o filtro de status (igual a rosca de
  // avanco). As secoes 3 e 4 ja carregam semantica de status interna (cobertura/plenas), por isso
  // nao se cruzam com o dropdown de Status geral. Cada secao reage ao Periodo de forma cumulativa.
  const strip = document.getElementById("cardstrip");
  if (strip) {
    const baseBalao = baseGeo.filter(atePeriodo);
    // SECAO 1 (Salas climatizadas): SALAS REAIS climatizadas, ACUMULADAS ate o periodo, sobre o total
    // de salas do TERRITORIO (denominador FIXO, independe do periodo). Numerador (sem dupla contagem):
    //   - salas das unidades clim/parc, pelo periodo da unidade (etapa: antes/2025/2026);
    //   - + 1 sala por escola NAO climatizada com sala de professores climatizada (ano pelo status:
    //     INSTALADA 2026 -> 2026; CLIMATIZADA/INSTALADA 2025 -> 2025).
    // FANTASMA (previsto, so em 2026/Todos): salas da etapa 02 ainda nao climatizadas/parciais.
    const E2 = window.ETAPA02 || {};
    const mostraFantasma = (periodoAtivo === "all" || periodoAtivo === "2026");
    let salasTerritorio = 0, salasClim = 0, fantasma = 0;
    // DENOMINADORES (territorio inteiro, TODOS os periodos -> FIXOS no filtro de periodo):
    // total de bairros, escolas, CEIs e unidades. Os numeradores (acumulados) vem do baseBalao.
    const totBairros = new Set(); let escTot = 0, ceiTot = 0;
    for (const e of baseGeo) {
      salasTerritorio += Number(e.salas) || 0;
      totBairros.add(e.bairro);
      if (e.tipo === "CEI") ceiTot++; else escTot++;
      const b = bucket(e.status);
      if (b === "clim" || b === "parc") {
        if ((ordPer[PERIODO[e.sge]] ?? 99) <= cutoff) salasClim += Number(e.salas) || 0;
      } else {
        const ano = salaProfAno(e.sge);
        if (ano && (ordPer[ano] ?? 99) <= cutoff) salasClim += 1;             // sala de professores
        if (mostraFantasma && (String(e.sge) in E2)) fantasma += Number(e.salas) || 0;  // etapa 02 a fazer
      }
    }
    const totUnidades = baseGeo.length;
    // NUMERADORES (acumulados ate o periodo, via baseBalao): cobertura e climatizadas por tipo
    let bInv = 0, bInv25 = 0, bInv26 = 0;
    let cobUni = 0; const cobBairros = new Set();
    let escClim = 0, ceiClim = 0;
    for (const e of baseBalao) {
      if (bucket(e.status) !== "iniciar") { cobUni++; cobBairros.add(e.bairro); }  // cobertura = nao "A iniciar"
      if (String(e.status).startsWith("9.")) { if (e.tipo === "CEI") ceiClim++; else escClim++; }  // so plenas (status 9)
      const arr = EXECUCAO[e.sge];
      if (arr) for (const x of arr) {
        if (typeof x.totalGasto === "number") {
          bInv += x.totalGasto;
          const et = String(x.etapa || "").toUpperCase();                          // ano pela aba/etapa
          if (et.startsWith("ETAPA 01")) bInv25 += x.totalGasto;
          else if (et.startsWith("ETAPA 02")) bInv26 += x.totalGasto;
        }
      }
    }
    // SECAO 1: rosca cumulativa. Verde SOLIDO = executado real (salasClim/territorio); o % em destaque
    // e sempre o real. Quando ha fantasma (2026/Todos), faixa verde TRANSPARENTE por cima = previsto.
    const pctSalas = pctNum(salasClim, salasTerritorio);
    const pctFant = pctNum(fantasma, salasTerritorio);
    const R = 16, W = 5, C = 2 * Math.PI * R;
    const fR = Math.max(0, Math.min(1, pctSalas / 100));
    const fF = Math.max(0, Math.min(1 - fR, pctFant / 100));
    const arcFant = fF > 0
      ? `<circle cx="20" cy="20" r="${R}" fill="none" stroke="var(--verde)" stroke-opacity=".30" stroke-width="${W}"
           stroke-dasharray="${(fF * C).toFixed(2)} ${C.toFixed(2)}" transform="rotate(${(fR * 360 - 90).toFixed(2)} 20 20)"/>`
      : "";
    const donut =
      `<svg class="mini-donut" viewBox="0 0 40 40" role="img" aria-label="${fmtPct(salasClim, salasTerritorio)}% das salas climatizadas">
         <circle cx="20" cy="20" r="${R}" fill="none" stroke="#EDEAE2" stroke-width="${W}"/>
         ${arcFant}
         <circle cx="20" cy="20" r="${R}" fill="none" stroke="var(--verde)" stroke-width="${W}"
           stroke-dasharray="${(fR * C).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 20 20)" stroke-linecap="round"/>
         <text x="20" y="23.5" text-anchor="middle" class="mini-donut-num" font-size="9">${fmtPct(salasClim, salasTerritorio)}%</text>
       </svg>`;
    const pctVerba = pctNum(bInv, PARQUE_VERBA);
    strip.innerHTML =
      // 1) SALAS CLIMATIZADAS (verde)
      `<div class="metricard">
         <div class="mc-lab">Salas climatizadas</div>
         <div class="mc-donut-row">${donut}
           <div class="mc-donut-sub">${salasClim.toLocaleString("pt-BR")} de ${salasTerritorio.toLocaleString("pt-BR")} salas</div>
         </div>
       </div>` +
      // 2) INVESTIMENTO (laranja): total + barra + quebra por ano
      `<div class="metricard">
         <div class="mc-lab">Investimento</div>
         <div class="mc-num">${moedaCompacta(bInv)}</div>
         <div class="mc-bar"><span style="width:${pctVerba.toFixed(1)}%"></span></div>
         <div class="mc-anos">
           <span><b>2025</b> ${moedaCompacta(bInv25)}</span>
           <span><b>2026</b> ${moedaCompacta(bInv26)}</span>
         </div>
       </div>` +
      // 3) COBERTURA (azul): bairros (grande) + barra (proporcao de bairros) + unidades (menor)
      `<div class="metricard">
         <div class="mc-lab">Cobertura</div>
         <div class="mc-num">${cobBairros.size}<span class="mc-unit"> de ${totBairros.size} bairros</span></div>
         <div class="mc-bar mc-bar-cob"><span style="width:${pctNum(cobBairros.size, totBairros.size).toFixed(1)}%"></span></div>
         <div class="mc-sub">${cobUni.toLocaleString("pt-BR")} de ${totUnidades.toLocaleString("pt-BR")} unidades</div>
       </div>` +
      // 4) CLIMATIZADAS POR TIPO (roxo): duas barras (Escolas / CEI), so plenas
      `<div class="metricard">
         <div class="mc-lab">Climatizadas por tipo</div>
         <div class="mc-tipos">
           <div class="mc-tipo">
             <div class="mc-tipo-top"><span>Escolas</span><b>${escClim} / ${escTot}</b></div>
             <div class="mc-bar2"><span style="width:${pctNum(escClim, escTot).toFixed(1)}%"></span></div>
           </div>
           <div class="mc-tipo">
             <div class="mc-tipo-top"><span>CEI (creche)</span><b>${ceiClim} / ${ceiTot}</b></div>
             <div class="mc-bar2"><span style="width:${pctNum(ceiClim, ceiTot).toFixed(1)}%"></span></div>
           </div>
         </div>
       </div>`;
  }
}

// ---------- panorama / funil (Camada 3) ----------
function renderPanorama() {
  // funil/panorama acompanham o recorte geografico + o filtro de periodo (sem o status,
  // que e justamente o que o funil decompoe).
  const base = ESCOLAS.filter(e => passaFiltroGeo(e) && passaPeriodo(e));
  const total = base.length;

  // contagem por bucket: a iniciar (0-4) / em execucao (5-8) / parcial (10) / climatizada (9)
  let nClim = 0, nParc = 0, nInic = 0, nAnd = 0, nSemSub = 0, invest = 0;
  for (const e of base) {
    const b = bucket(e.status);
    if (b === "clim") nClim++; else if (b === "parc") nParc++;
    else if (b === "iniciar") nInic++; else nAnd++;
    if (String(e.subestacao).trim().toUpperCase() === "NÃO") nSemSub++;
    const arr = EXECUCAO[e.sge];
    if (arr) for (const x of arr) if (typeof x.totalGasto === "number") invest += x.totalGasto;
  }

  document.getElementById("pano-total").textContent = total;

  const kpis = [
    { lab: "Climatizadas", val: nClim, cls: "k-clim" },
    { lab: "Parciais", val: nParc, cls: "k-parc" },
    { lab: "Em execução", val: nAnd, cls: "k-and" },
    { lab: "A iniciar", val: nInic, cls: "k-init" }
  ];
  document.getElementById("kpis").innerHTML = kpis.map(k =>
    `<div class="kpi ${k.cls}"><div class="kpi-val">${k.val}</div><div class="kpi-lab">${k.lab}</div></div>`
  ).join("");

  // funil simplificado: 4 grupos por bucket (A iniciar / Em execução / Parcial / Climatizada).
  // Clicar numa faixa ABRE a lista das unidades daquela faixa (agrupada por distrito); NAO filtra o mapa.
  const GRUPOS = [
    ["iniciar",  "A iniciar",           nInic],
    ["pipeline", "Em execução",         nAnd],
    ["parc",     "Climatizada parcial", nParc],
    ["clim",     "Climatizada",         nClim]
  ];
  const max = Math.max(1, ...GRUPOS.map(g => g[2]));
  document.getElementById("funil").innerHTML = GRUPOS.map(([k, lab, c]) => {
    const pct = Math.round((c / max) * 100);
    const aberta = funilExpandido === k;
    const bar = `<button class="fbar${aberta ? " on" : ""}" type="button" data-b="${k}" aria-expanded="${aberta}">
      <span class="fbar-lab">${lab}</span>
      <span class="fbar-track"><span class="fbar-fill bk-${k}" style="width:${pct}%"></span></span>
      <span class="fbar-num">${c}</span>
    </button>`;
    return bar + (aberta ? funilListaHTML(k, base) : "");
  }).join("") +
    // total do recorte (soma das 4 faixas) no rodape do funil
    `<div class="funil-total"><span class="ft-lab">Total de unidades</span><span class="ft-num">${total}</span></div>`;

  // clique na faixa: abre/fecha a lista (toggle); clicar em outra fecha a anterior. NAO toca no mapa.
  document.querySelectorAll("#funil .fbar").forEach(btn => btn.onclick = () => {
    funilExpandido = (funilExpandido === btn.dataset.b) ? null : btn.dataset.b;
    renderPanorama();   // re-renderiza so o painel/funil; o mapa fica intacto
  });
  document.querySelectorAll("#funil .fl-close").forEach(btn => btn.onclick = ev => {
    ev.stopPropagation(); funilExpandido = null; renderPanorama();
  });
  document.querySelectorAll("#funil .fl-item").forEach(btn => btn.onclick = ev => {
    ev.stopPropagation(); abreFicha(btn.dataset.sge);
  });
}

// lista das unidades de uma faixa do funil, agrupada por DISTRITO (rolavel; cada item abre a ficha).
// base = recorte do funil (territorio + periodo), o mesmo das contagens das faixas.
function funilListaHTML(k, base) {
  const us = base.filter(e => bucket(e.status) === k);
  const porDist = {};
  for (const e of us) (porDist[e.distrito] = porDist[e.distrito] || []).push(e);
  const ordem = ["I", "II", "III", "IV", "V", "VI"];
  const dists = Object.keys(porDist).sort((a, b) => {
    const ia = ordem.indexOf(a) < 0 ? 99 : ordem.indexOf(a);
    const ib = ordem.indexOf(b) < 0 ? 99 : ordem.indexOf(b);
    return ia - ib || String(a).localeCompare(String(b), "pt-BR");
  });
  const cat = BUCKET_LABEL[k] || k;   // CATEGORIA do funil (tag de cada unidade mostra isso)
  const grupos = dists.map(d => {
    const lista = porDist[d].slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    const itens = lista.map(e =>
      `<button class="fl-item" type="button" data-sge="${e.sge}">` +
        `<span class="fl-nome">${e.nome}</span>` +
        `<span class="pill ${PILL[k]}">${cat}</span></button>`   // tag = categoria do funil, nao o estagio detalhado
    ).join("");
    return `<div class="fl-grupo"><div class="fl-dist">Distrito ${d}<span class="fl-dist-n">${lista.length}</span></div>${itens}</div>`;
  }).join("");
  const n = us.length;
  return `<div class="funil-lista">` +
    `<div class="fl-head">` +
      `<div class="fl-bc"><span class="fl-bc-raiz">Funil</span><span class="fl-bc-sep">&rsaquo;</span>` +
        `<span class="fl-bc-cat">${cat}</span>` +
        `<span class="fl-bc-n">${n} unidade${n === 1 ? "" : "s"}</span></div>` +
      `<button class="fl-close" type="button" aria-label="Fechar sub-lista"><span class="fl-close-ico">&larr;</span>Fechar</button>` +
    `</div>` +
    `<div class="fl-ajuda">Você abriu a sub-lista da faixa <b>${cat}</b>, agrupada por distrito. Clique numa unidade para abrir a ficha.</div>` +
    `<div class="fl-scroll">${grupos || '<div class="fl-vazia">Nenhuma unidade neste recorte.</div>'}</div></div>`;
}

// ---------- lista / busca ----------
const PILL = { clim:"p-clim", parc:"p-parc", pipeline:"p-pipe", iniciar:"p-init" };
// rotulo da CATEGORIA do funil por bucket (usado na tag da sub-lista do funil)
const BUCKET_LABEL = { iniciar:"A iniciar", pipeline:"Em execução", parc:"Climatizada parcial", clim:"Climatizada" };

const RE_DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");
function normaliza(s) {
  return String(s == null ? "" : s).toLowerCase()
    .normalize("NFD").replace(RE_DIACRITICOS, "");
}

// alias de bairro: dois bairros compostos tem a barra grafada diferente entre o geojson
// ("BOA VISTA / CASTELAO", com espacos) e o campo das escolas ("BOA VISTA/CASTELAO", sem);
// assim a key normalizada nao casa e o poligono fica sem a cor da regional. Canoniza cada
// um pela parte distintiva (Castelao / Sapiranga) pra casar como os demais bairros.
// Aplicado so no join bairro<->geojson (nao na busca), em todos os pontos da key normalizada.
function aliasBairro(nk) {
  if (nk.includes("castelao")) return "castelao";
  if (nk.includes("sapiranga")) return "sapiranga";
  return nk;
}

function renderLista() {
  const termo = normaliza(document.getElementById("q").value.trim());
  // BUSCAR UNIDADE: a lista mostra SEMPRE as 512 unidades (nao reage a periodo/status/territorio);
  // somente a busca textual filtra.
  const base = ESCOLAS;
  const filtradas = termo
    ? base.filter(e =>
        normaliza(e.nome).includes(termo) ||
        normaliza(e.sge).includes(termo) ||
        normaliza(e.bairro).includes(termo))
    : base;
  filtradas.sort((a, b) => normaliza(a.nome).localeCompare(normaliza(b.nome), "pt-BR"));

  const tbody = document.getElementById("tbody");
  document.getElementById("lista-contagem").textContent = filtradas.length;
  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="lista-vazia">Nenhuma unidade encontrada para essa busca.</td></tr>`;
    return;
  }
  const frag = document.createDocumentFragment();
  for (const e of filtradas) {
    const b = bucket(e.status);
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td class="nome">${e.nome || "—"}</td>` +
      `<td class="sge">${txt(e.sge)}</td>` +
      `<td class="bairro">${txt(e.bairro)}</td>` +
      `<td><span class="pill ${PILL[b]}">${BUCKET_LABEL[b]}</span></td>`;
    tr.addEventListener("click", () => abreFicha(e.sge));
    frag.appendChild(tr);
  }
  tbody.innerHTML = "";
  tbody.appendChild(frag);
}

// ---------- ficha (Camada 2) ----------
function kv(k, v){ return `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`; }

function blocoDiagnostico(sge, salas){
  const d = DIAGNOSTICO[sge];
  let h = `<div class="sect">Diagnóstico</div>`;
  h += kv("Nº de salas", txt(salas));   // trazido do cadastro: nº de salas / climatizaveis / aguardando
  if (!d) { return h + `<div class="empty">Sem registro de diagnóstico.</div>`; }
  h += kv("Salas climatizáveis", txt(d.salasClim));
  h += kv("Salas aguardando", txt(d.salasFora));
  h += kv("Data da visita", data(d.dataVisita));
  return h;
}

function blocoExecucao(sge){
  const lista = EXECUCAO[sge] || [];
  let h = `<div class="sect">Execução · custos</div>`;
  if (!lista.length) return h + `<div class="empty">Sem dados de execução (2025/26) para esta escola.</div>`;
  for (const x of lista) {
    const btus = [["12K",x.ar12],["18K",x.ar18],["24K",x.ar24],["36K",x.ar36],["48K",x.ar48]]
      .filter(([_,q]) => q).map(([k,q]) => `<span class="chip"><b>${q}×</b> ${k}</span>`).join("");
    h += `<div class="exec-bloco">
      <div class="exec-h">
        <span class="et">${txt(x.etapa)}${x.totalMaq?` · ${x.totalMaq} máquinas`:""}</span>
        <span class="gasto"><span class="lab">total gasto</span><br><span class="val">${moeda(x.totalGasto)}</span></span>
      </div>
      ${btus ? `<div class="btu">${btus}</div>` : ""}
      <div class="exec-custos">
        ${kv("Valor máquinas", moeda(x.valorMaq))}
        ${kv("Serv. civil", moeda(x.servCivil))}
        ${kv("Serv. elétrica", moeda(x.servEletrica))}
        ${kv("Serv. instalação", moeda(x.servInstalacao))}
        ${(x.statusCivil||x.statusEletrica||x.statusInstalacao) ? kv("Status (civil/elét./instal.)", `${txt(x.statusCivil)} / ${txt(x.statusEletrica)} / ${txt(x.statusInstalacao)}`) : ""}
        ${x.fim ? kv("Climatizada em", data(x.fim)) : ""}
      </div>
    </div>`;
  }
  return h;
}

// Secao de subestacao da ficha (fonte: SUBESTACAO[sge], do CSV). Independente do
// campo "Subestacao" do Cadastro e do "Necessita subestacao" do Diagnostico (nao os toca).
function blocoSubestacao(sge, b){
  const s = SUBESTACAO[sge];
  let h = `<div class="sect">Subestação · estudo elétrico</div>`;
  if (!s) return h + `<div class="empty">Sem dados de subestação.</div>`;
  const climatizada = (b === "clim" || b === "parc");   // ja climatizada (total/parcial)
  const possui = s.p === "SIM";
  h += kv("Possui subestação", possui ? "Sim" : "Não");
  // potencia atual: so quando possui e ha valor
  if (possui && s.pa) h += kv("Potência atual", s.pa);
  // "Necessita" so aparece se necessitar (NAO => nao mostra). Potencia futura entre
  // parenteses quando houver; e a data de solicitacao logo abaixo, se houver.
  if (s.n === "NOVA" || s.n === "AUMENTO") {
    const nec = s.n === "NOVA" ? "subestação nova" : "aumento de potência";
    h += kv("Necessita", s.pf ? `${nec} (${s.pf})` : nec);
    if (s.d) h += kv("Solicitada à SEINF em", s.d);
  }
  // Estudo eletrico: nas ja climatizadas (total/parcial) e Finalizado, definitivo (sem asterisco
  // nem nota); nas demais segue provisorio -> asterisco discreto + nota "em ajuste".
  if (climatizada) {
    h += kv("Estudo elétrico", "Finalizado");
  } else if (s.e === "TEM" || s.e === "FALTA") {
    h += kv("Estudo elétrico", `${s.e === "TEM" ? "finalizado" : "pendente"}<sup class="prov">*</sup>`);
    h += `<div class="prov-nota">* em ajuste</div>`;
  }
  return h;
}

// rotulo de status SO para exibicao na ficha: esconde o prefixo numerico "N. "
// (ex: "9. CLIMATIZADA" -> "CLIMATIZADA"). NAO altera e.status (navegacao/filtros/calculos usam).
function statusLabel(s){
  return String(s == null || s === "" ? "0. A INICIAR" : s).replace(/^\s*\d+\.\s*/, "");
}

function abreFicha(sge){
  const e = ESCOLAS.find(x => x.sge === sge); if (!e) return;
  const b = bucket(e.status);
  document.getElementById("dr-sge").textContent = `SGE ${e.sge} · ${e.tipo || ""}`;
  document.getElementById("dr-nome").textContent = e.nome || "";
  const st = document.getElementById("dr-status");
  st.textContent = statusLabel(e.status);   // so exibicao; e.status (com numero) fica intacto
  st.className = "st " + STCLS[b];

  // selo de periodo em destaque no topo (usa PERIODO[sge] + a faixa/bucket atual). Para o lote de
  // 2025/2026 o texto segue a NOVA classificacao: climatizada / em execucao (5-8) / a iniciar (0-4).
  const per = PERIODO[e.sge];
  const clima = (b === "clim" || b === "parc");
  let seloTxt, seloCls;
  if (per === "antes") { seloTxt = "Climatizada antes de 2025"; seloCls = "selo-antes"; }
  else if (per === "2025" || per === "2026") {
    if (clima)                { seloTxt = `Climatizada em ${per}`;               seloCls = (per === "2025") ? "selo-2025" : "selo-2026"; }
    else if (b === "pipeline"){ seloTxt = `Em execução de climatização ${per}`;  seloCls = "selo-proc"; }
    else                      { seloTxt = `A iniciar em ${per}`;                 seloCls = "selo-init"; }
  } else { seloTxt = "A iniciar"; seloCls = "selo-init"; }   // sem periodo (2027/2028): neutro discreto
  const selo = document.getElementById("dr-selo");
  selo.textContent = seloTxt;
  selo.className = "dr-selo " + seloCls;

  // Cadastro: cabecalho discreto da ficha (compacto, sem chamar atencao). Nº de salas saiu
  // daqui e foi pro Diagnostico.
  let h = `<div class="dr-cad"><div class="sect">Cadastro</div>`;
  h += kv("Regional", txt(e.regional));
  h += kv("Distrito", txt(e.distrito));
  h += kv("Bairro", txt(e.bairro));
  h += kv("Território", txt(e.territorio));
  h += kv("Etapa", txt(e.etapa));
  if (e.endereco) h += kv("Endereço", e.endereco);
  h += `</div>`;

  h += blocoSubestacao(sge, b);
  // Historico (Diagnostico, Execucao) so nas unidades de periodo 2025 em diante; as de
  // "antes de 2025" foram climatizadas antes desse processo existir e nao tem historico.
  if (PERIODO[e.sge] !== "antes") {
    // Diagnostico so nas NAO climatizadas (climatizada/parcial dispensam diagnostico)
    if (b !== "clim" && b !== "parc") h += blocoDiagnostico(sge, e.salas);
    h += blocoExecucao(sge);
  }

  document.getElementById("dr-body").innerHTML = h;
  document.getElementById("drawer").classList.add("on");
  document.getElementById("scrim").classList.add("on");
  document.getElementById("drawer").setAttribute("aria-hidden", "false");
}

function fechaDrawerSub(){
  const d = document.getElementById("drawer-sub");
  if (!d || !d.classList.contains("on")) return;
  d.classList.remove("on");
  d.setAttribute("aria-hidden", "true");
  document.getElementById("scrim").classList.remove("on");
  subCatSel = "all";
  renderMapaSub();
}
// fecha o drawer-sub sem resetar o filtro do mapa (usado ao abrir ficha de escola a partir da lista)
function fechaDrawerSubSilent(){
  const d = document.getElementById("drawer-sub");
  if (!d) return;
  d.classList.remove("on");
  d.setAttribute("aria-hidden", "true");
}

function abreDrawerSub(cat){
  const drawerSub = document.getElementById("drawer-sub");
  const scrim = document.getElementById("scrim");
  if (!drawerSub) return;
  if (cat === "all") { fechaDrawerSub(); return; }
  const c = SUBCAT[cat];
  if (!c) return;
  const escolas = (subPorCat[cat] || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const byDist = {};
  for (const e of escolas) {
    const d = e.distrito || "—";
    if (!byDist[d]) byDist[d] = [];
    byDist[d].push(e);
  }
  const distritos = Object.keys(byDist).sort();
  document.getElementById("dr-sub-head").innerHTML =
    `<div class="dr-sub-ico" style="--cat:${c.cor}">` +
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${c.ico}</svg></div>` +
    `<div class="dr-sub-tit">${c.lab}</div>` +
    `<div class="dr-sub-count">${escolas.length} unidade${escolas.length !== 1 ? "s" : ""} no recorte</div>`;
  const body = document.getElementById("dr-sub-body");
  body.innerHTML = distritos.map(d => {
    const items = byDist[d];
    return `<div class="dr-sub-dist">` +
      `<div class="dr-sub-dist-lab">Distrito ${d}</div>` +
      `<ul class="dr-sub-list">` +
      items.map(e =>
        `<li class="dr-sub-item dr-sub-clicavel" data-sge="${e.sge}">` +
        `<span class="dr-sub-tipo">${e.tipo}</span><span>${e.nome}</span>` +
        `<span class="dr-sub-seta">›</span></li>`
      ).join("") +
      `</ul></div>`;
  }).join("");
  body.querySelectorAll(".dr-sub-clicavel").forEach(li => {
    li.onclick = () => { abreFicha(li.dataset.sge); };  // abre ficha por cima; lista permanece abaixo
  });
  scrim.classList.add("on");
  drawerSub.classList.add("on");
  drawerSub.setAttribute("aria-hidden", "false");
}

function fechaFicha(){
  document.getElementById("drawer").classList.remove("on");
  document.getElementById("drawer").setAttribute("aria-hidden", "true");
  // mantem scrim se o drawer-sub ainda estiver aberto (usuario volta para a lista)
  const drawerSub = document.getElementById("drawer-sub");
  if (!drawerSub || !drawerSub.classList.contains("on")) {
    document.getElementById("scrim").classList.remove("on");
  }
}

// ---------- 2o mapa: subestacao / estudo eletrico ----------
// pontos nas MESMAS coordenadas das unidades, coloridos pela CATEGORIA do mapa_sub.js.
// Hierarquia visual: acoes (nova/aumento/falta_estudo) maiores e opacas (saltam);
// climatizada/liberada menores e esmaecidas (recuam). Ordem listada = ordem de desenho
// (concluidas primeiro, acoes por cima).
// Categorias da subestacao. cor/r/op/w = pontos do mapa (mantidos). lab = rotulo exibido.
// ico = simbolo SVG distinto por categoria (inner paths; usa currentColor = cor da categoria).
const SUBCAT = {
  climatizada:  { cor: "#7FBE9B", r: 3.6, op: .58, w: .8, lab: "Concluída",
                  ico: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5.5"/>' },                 // check em circulo = concluida
  liberada:     { cor: "#C9B68C", r: 4.2, op: .72, w: 1,  lab: "Apta, sem aumento ou implantação de Subestação",
                  ico: '<path d="M12 3l7 3v5c0 4.5-3.1 7.6-7 9-3.9-1.4-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>' }, // escudo com check = apta
  falta_estudo: { cor: "#1F6F9E", r: 5.6, op: .92, w: 1.4, lab: "Aguardando estudo elétrico",
                  ico: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 1.6"/>' },                              // relogio = aguardando
  aumento:      { cor: "#E0612B", r: 6,   op: .95, w: 1.5, lab: "Aumento de carga",
                  ico: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>' },                                    // seta subindo = aumento de carga
  nova:         { cor: "#C0432E", r: 6,   op: .95, w: 1.5, lab: "Nova subestação",
                  ico: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>' }                                             // raio = nova subestacao
};
const ORDEM_SUB = ["climatizada", "liberada", "falta_estudo", "aumento", "nova"]; // desenho: discretas -> acoes
let mapSub = null, subLayer = null;
let subCatSel = "all";   // filtro por situacao (selecao unica): "all" = todas, ou uma categoria isolada
let subPorCat = {};      // cache do ultimo renderMapaSub para o drawer de listagem
let subMarkers = [];     // {m, base} para reescalar o raio dos pontos quando o zoom muda
// raio dos pontos cresce suavemente com o zoom: menor afastado (reduz a "sopa"), maior aproximado.
function subScale(){
  if (!mapSub) return .75;
  const z = mapSub.getZoom();
  return Math.max(.62, Math.min(1.12, .75 + (z - 11.4) * 0.16));
}
function ajustaRaioSub(){ const s = subScale(); for (const o of subMarkers) o.m.setRadius(o.base * s); }
// recorte do 2o mapa = territorio (drill) + periodo, mesma logica do mapa principal (SEM status).
// Assim os contadores/pontos recalculam quando ha filtro de periodo ou territorio ativo.
function passaSubmapa(e){ return passaFiltroGeo(e) && passaPeriodo(e); }
function initMapaSub(){
  const el = document.getElementById("map-sub");
  if (!el || mapSub) return;
  mapSub = L.map("map-sub", { scrollWheelZoom: false, zoomSnap: 0, zoomDelta: 1 }).setView([-3.768, -38.545], 11.4);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19, subdomains: "abcd", attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(mapSub);
  // shapes padrao (distritos) como pano de fundo, igual ao nivel 0 do mapa principal.
  // Pane abaixo dos pontos e NAO-interativo, pra os cliques chegarem nos pontos (abrem a ficha).
  mapSub.createPane("subShapes");
  mapSub.getPane("subShapes").style.zIndex = 350;             // overlayPane (pontos) = 400
  mapSub.getPane("subShapes").style.pointerEvents = "none";
  L.geoJSON(window.DISTRITOS || null, {
    pane: "subShapes", interactive: false,
    style: f => ({ color: "#2A2A2A", weight: 2.7, opacity: .9, fillColor: f.properties.cor, fillOpacity: .18 })
  }).addTo(mapSub);
  subLayer = L.layerGroup().addTo(mapSub);
  mapSub.on("zoomend", ajustaRaioSub);   // reescala o raio dos pontos conforme o zoom
  renderMapaSub();
}
// re-desenha pontos + recalcula contadores e legenda para o recorte atual (territorio + periodo)
function renderMapaSub(){
  if (!subLayer) return;
  subLayer.clearLayers();
  subMarkers = [];
  const cont = {}, porCat = {};
  for (const k of ORDEM_SUB) { cont[k] = 0; porCat[k] = []; }
  for (const e of TODAS) {
    if (!passaSubmapa(e)) continue;
    const cat = MAPA_SUB[String(e.sge)];
    if (cat && porCat[cat]) { porCat[cat].push(e); cont[cat]++; }
  }
  subPorCat = porCat;
  // desenha discretas primeiro, acoes por cima. Selecao unica: "all" mostra tudo; senao isola 1.
  for (const cat of ORDEM_SUB) {
    if (subCatSel !== "all" && cat !== subCatSel) continue;
    const cfg = SUBCAT[cat];
    for (const e of porCat[cat]) {
      // ponto redondo com aro branco fino + leve sombra (.sub-pt); preenchimento ~85% deixa
      // ver densidade quando se sobrepoem. Raio = base da categoria * escala do zoom.
      const m = L.circleMarker(e._latlng, {
        radius: cfg.r * subScale(), weight: 1.5, color: "#fff", opacity: .95,
        fillColor: cfg.cor, fillOpacity: .85, className: "sub-pt"
      });
      m.on("click", () => abreFicha(e.sge));
      m.bindTooltip(`${e.nome} — ${cfg.lab}`, { direction: "top", offset: [0, -4] });
      subLayer.addLayer(m);
      subMarkers.push({ m, base: cfg.r });
    }
  }
  // contadores do topo (recalculam com filtro) + total do recorte
  const total = ORDEM_SUB.reduce((s, k) => s + cont[k], 0);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("sub-total", total);
  // BLOCO CONSOLIDADO das 5 categorias no topo (icone distinto + contagem + rotulo). Recalcula
  // com o filtro de periodo/territorio. Mesma ordem dos chips (acoes primeiro, concluidas depois).
  const legOrder = ["nova", "aumento", "falta_estudo", "liberada", "climatizada"];
  const cats = document.getElementById("sub-cats");
  if (cats) {
    cats.innerHTML = legOrder.map(k => {
      const c = SUBCAT[k], sel = subCatSel === k;
      return `<div class="sub-cat${sel ? " sub-cat-sel" : ""}" data-cat="${k}" style="--cat:${c.cor}">` +
        `<span class="sub-cat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${c.ico}</svg></span>` +
        `<span class="sub-cat-body"><b class="sub-cat-n">${cont[k]}</b><span class="sub-cat-lab">${c.lab}</span></span>` +
        `</div>`;
    }).join("");
    cats.querySelectorAll(".sub-cat").forEach(el => {
      el.onclick = () => {
        const k = el.dataset.cat;
        if (subCatSel === k) {
          abreDrawerSub(k);          // 2o clique: ja selecionado -> abre lista
        } else {
          subCatSel = k;
          renderMapaSub();           // 1o clique: seleciona e filtra mapa
          fechaDrawerSub();          // fecha lista se estava aberta de outra categoria
        }
      };
    });
  }
  // chips de filtro por situacao (coluna direita), SELECAO UNICA: clicar isola so aquela
  // categoria no mapa (apaga o resto); "Todas" volta a mostrar tudo. Clicar na ja selecionada
  // tambem volta pra "Todas". Contagens = recorte (periodo/territorio).
  const fl = document.getElementById("smf-list");
  if (fl) {
    const selAll = subCatSel === "all";
    const chipTodas =
      `<button type="button" class="smf-chip smf-todas-chip${selAll ? " sel" : ""}" data-cat="all">` +
      `<span class="smf-nome">Todas as situações</span><span class="smf-n">${total}</span></button>`;
    const chipsCat = legOrder.map(k => {
      const c = SUBCAT[k], sel = subCatSel === k;
      const selStyle = sel
        ? ` style="background:color-mix(in srgb,${c.cor} 14%,#fff);border-color:color-mix(in srgb,${c.cor} 45%,#fff)"`
        : "";
      return `<button type="button" class="smf-chip${sel ? " sel" : ""}" data-cat="${k}"${selStyle}>` +
        `<span class="smf-sw" style="background:${c.cor}"></span>` +
        `<span class="smf-nome">${c.lab}</span>` +
        `<span class="smf-n">${cont[k]}</span></button>`;
    }).join("");
    fl.innerHTML = chipTodas + chipsCat;
    fl.querySelectorAll(".smf-chip").forEach(btn => btn.onclick = () => {
      const k = btn.dataset.cat;
      // single-select com toggle: clicar na categoria ja ativa volta pra "all"
      if (k === "all") {
        subCatSel = "all"; renderMapaSub(); fechaDrawerSub();
      } else if (subCatSel === k) {
        abreDrawerSub(k);            // 2o clique: abre lista
      } else {
        subCatSel = k; renderMapaSub(); fechaDrawerSub();  // 1o clique: filtra
      }
    });
  }
}

// ---------- init ----------
function init(){
  preparaCoordenadas(ESCOLAS);
  initMapaSub();
  montaDrill();
  montaChipsRegional(ESCOLAS);
  preencheSelect("sel-distrito", new Set(ESCOLAS.map(e => e.distrito)));
  preencheSelect("sel-bairro", new Set(ESCOLAS.map(e => e.bairro)));
  // Status geral: os 4 grupos do funil (oculta os status individuais; value = bucket = funilBucket).
  document.getElementById("sel-status").innerHTML =
    '<option value="">Todos</option>' +
    '<option value="iniciar">A iniciar</option>' +
    '<option value="pipeline">Em execução</option>' +
    '<option value="parc">Climatizada parcial</option>' +
    '<option value="clim">Climatizada</option>';
  montaPeriodos();

  ["sel-distrito","sel-bairro"].forEach(id =>
    document.getElementById(id).addEventListener("change", aplicaFiltros));
  // Status geral e o funil sao o MESMO filtro por grupo: mexer no dropdown ajusta o funilBucket
  document.getElementById("sel-status").addEventListener("change", e => {
    funilBucket = e.target.value || null; aplicaFiltros();
  });
  // botoes de periodo: filtram mapa/lista/funil reusando aplicaFiltros (igual o Status geral)
  document.querySelectorAll("#f-periodo button").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll("#f-periodo button").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    periodoAtivo = b.dataset.p;
    aplicaFiltros();
  }));
  document.getElementById("f-limpar").addEventListener("click", () => {
    regionalAtiva = "all";
    document.querySelectorAll("#f-regional button").forEach((b,i) => b.classList.toggle("on", i===0));
    ["sel-distrito","sel-bairro","sel-status"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("q").value = "";
    // reseta o filtro de periodo de volta para "Todos"
    periodoAtivo = "all";
    document.querySelectorAll("#f-periodo button").forEach((b,i) => b.classList.toggle("on", i===0));
    funilBucket = null;   // limpa o grupo selecionado no funil
    // volta o drill ao nivel 0 (mapa cheio com os 6 distritos) sem aplicar filtros 2x
    drillDistrito = null;
    drillRegional = null;
    drillBairro = null;
    focaDistritoNoMapa(null);
    setRegionaisDoDistrito(null);
    setBairrosDaRegional(null);
    map.setView(VIEW0.center, VIEW0.zoom);
    renderTrilha();
    aplicaFiltros();
  });
  document.getElementById("q").addEventListener("input", renderLista);
  document.getElementById("dr-close").addEventListener("click", fechaFicha);
  document.getElementById("dr-sub-close").addEventListener("click", fechaDrawerSub);
  document.getElementById("scrim").addEventListener("click", () => { fechaFicha(); fechaDrawerSub(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { fechaFicha(); fechaDrawerSub(); } });

  const nota = document.getElementById("sem-coord");
  const avisos = [];
  if (nCentroide) avisos.push(`${nCentroide} por centroide de bairro`);
  if (SEM_COORD.length) avisos.push(`${SEM_COORD.length} sem posição`);
  nota.textContent = avisos.length ? ` · ${avisos.join(", ")}` : "";
  aplicaFiltros();
  // o mapa agora divide a largura com o painel de contexto (flex): recalcula o tamanho
  setTimeout(() => { map.invalidateSize(); if (mapSub) mapSub.invalidateSize(); }, 0);
  window.addEventListener("resize", () => { map.invalidateSize(); if (mapSub) mapSub.invalidateSize(); });
}

init();
