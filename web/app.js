// Portal da Climatizacao Escolar - Fortaleza
// Camada 1 (mapa) + Camada 2 (ficha da escola)

const DOTCOL = { clim:"#3F9A52", parc:"#6FB97C", pipeline:"#E2A030", iniciar:"#A9A296" };
const STCLS  = { clim:"st-clim", parc:"st-parc", pipeline:"st-pipe", iniciar:"st-init" };

const ESCOLAS     = window.ESCOLAS || [];
const DIAGNOSTICO = window.DIAGNOSTICO || {};
const OS          = window.OS || {};
const EXECUCAO    = window.EXECUCAO || {};
const LIMITE_DIAS_OS = 15;

function bucket(status) {
  const s = (status || "0. A INICIAR").trim();
  if (s === "9. CLIMATIZADA") return "clim";
  if (s === "10. CLIMATIZADA PARCIAL") return "parc";
  if (s === "0. A INICIAR") return "iniciar";
  return "pipeline";
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
const map = L.map("map", { scrollWheelZoom: false }).setView([-3.768, -38.545], 11.4);
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
const FIT_PAD = [40, 40];   // folga (px) na borda do fitBounds pra o contorno do territorio nao ser cortado

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
    if (String(e.regional) === String(regionalNum)) set.add(normaliza(e.bairro));
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
  const nk = normaliza(rawKey);
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
  const forta = `<a class="crumb link" id="crumb-forta">Fortaleza</a>`;
  const sep = `<span class="sep">›</span>`;
  const atual = t => `<span class="crumb atual">${t}</span>`;
  const linkDist = `<a class="crumb link" id="crumb-dist">${nomeDistrito(drillDistrito)}</a>`;
  const linkReg = `<a class="crumb link" id="crumb-reg">${nomeRegional(drillRegional)}</a>`;
  let html;
  if (drillModo === "regionais") {
    // trilha sem distrito: Fortaleza > Regional > Bairro
    if (drillRegional == null) html = atual("Fortaleza");
    else if (drillBairro == null) html = forta + sep + atual(nomeRegional(drillRegional));
    else html = forta + sep + linkReg + sep + atual(nomeBairro(drillBairro));
  } else {
    // trilha com distrito: Fortaleza > Distrito > Regional > Bairro
    if (drillDistrito == null) html = atual("Fortaleza");
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
  bairrosLayer.eachLayer(l => { bairrosSubs[normaliza(l.feature.properties.key)] = l; });
  ESCOLAS.forEach(e => { if (e.bairro != null) BAIRRO_REAL[normaliza(e.bairro)] = e.bairro; });

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

// predicado compartilhado entre mapa e lista (geografico + status; a busca textual e so da lista)
function passaFiltro(e) {
  if (!passaFiltroGeo(e)) return false;
  const fs = document.getElementById("sel-status").value;
  if (fs && e.status !== fs) return false;
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
  renderPanorama();
}

// ---------- panorama / funil (Camada 3) ----------
const FUNIL = [
  ["0. A INICIAR", "iniciar", "A iniciar"],
  ["1. VISTORIA", "pipeline", "Vistoria"],
  ["2. ANALISE ELETRICA E CIVIL", "pipeline", "Análise elétrica e civil"],
  ["3. ORÇAMENTO E PLANTA", "pipeline", "Orçamento e planta"],
  ["4. APROVAÇÃO A.S.", "pipeline", "Aprovação A.S."],
  ["5. EXECUÇÃO DAS ADEQUAÇÕES", "pipeline", "Execução das adequações"],
  ["6. ENTREGA DE MÁQUINAS", "pipeline", "Entrega de máquinas"],
  ["9. CLIMATIZADA", "clim", "Climatizada"],
  ["10. CLIMATIZADA PARCIAL", "parc", "Climatizada parcial"]
];

function renderPanorama() {
  const base = ESCOLAS.filter(passaFiltroGeo);
  const total = base.length;

  // contagem por status + por bucket
  const cont = {};
  let nClim = 0, nParc = 0, nInic = 0, nAnd = 0, nSemSub = 0, invest = 0;
  for (const e of base) {
    cont[e.status] = (cont[e.status] || 0) + 1;
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
    { lab: "Em andamento", val: nAnd, cls: "k-and" },
    { lab: "A iniciar", val: nInic, cls: "k-init" },
    { lab: "Investido · execução", val: moeda(invest), cls: "k-inv" },
    { lab: "Represa · sem subestação", val: nSemSub, cls: "k-sub" }
  ];
  document.getElementById("kpis").innerHTML = kpis.map(k =>
    `<div class="kpi ${k.cls}"><div class="kpi-val">${k.val}</div><div class="kpi-lab">${k.lab}</div></div>`
  ).join("");

  const fsAtivo = document.getElementById("sel-status").value;
  const max = Math.max(1, ...FUNIL.map(([s]) => cont[s] || 0));
  document.getElementById("funil").innerHTML = FUNIL.map(([s, b, lab]) => {
    const c = cont[s] || 0;
    const pct = Math.round((c / max) * 100);
    return `<button class="fbar${fsAtivo === s ? " on" : ""}" data-s="${s}">
      <span class="fbar-lab">${lab}</span>
      <span class="fbar-track"><span class="fbar-fill bk-${b}" style="width:${pct}%"></span></span>
      <span class="fbar-num">${c}</span>
    </button>`;
  }).join("");

  document.querySelectorAll("#funil .fbar").forEach(btn => btn.onclick = () => {
    const sel = document.getElementById("sel-status");
    sel.value = (sel.value === btn.dataset.s) ? "" : btn.dataset.s; // alterna
    aplicaFiltros();
  });
}

// ---------- lista / busca ----------
const PILL = { clim:"p-clim", parc:"p-parc", pipeline:"p-pipe", iniciar:"p-init" };

const RE_DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");
function normaliza(s) {
  return String(s == null ? "" : s).toLowerCase()
    .normalize("NFD").replace(RE_DIACRITICOS, "");
}

function renderLista() {
  const termo = normaliza(document.getElementById("q").value.trim());
  // a lista considera todas as escolas (inclusive sem coordenada), respeitando os filtros estruturais
  const base = ESCOLAS.filter(passaFiltro);
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
    tbody.innerHTML = `<tr><td colspan="4" class="lista-vazia">Nenhuma escola encontrada para esse filtro.</td></tr>`;
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
      `<td><span class="pill ${PILL[b]}">${e.status || "0. A INICIAR"}</span></td>`;
    tr.addEventListener("click", () => abreFicha(e.sge));
    frag.appendChild(tr);
  }
  tbody.innerHTML = "";
  tbody.appendChild(frag);
}

// ---------- ficha (Camada 2) ----------
function kv(k, v){ return `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`; }

function blocoDiagnostico(sge){
  const d = DIAGNOSTICO[sge];
  let h = `<div class="sect">Diagnóstico (estudo do Ed)</div>`;
  if (!d) { return h + `<div class="empty">Sem registro de diagnóstico.</div>`; }
  h += kv("Salas climatizáveis", txt(d.salasClim));
  h += kv("Salas fora", txt(d.salasFora));
  h += kv("Necessita subestação", txt(d.necessitaSub));
  h += kv("Estágio do repasse", txt(d.estagio));
  if (d.estagio) {
    const est = d.estagio;
    if (/^2\./.test(est)) h += `<div class="gargalo"><b>Atenção:</b> estudo concluído, aguardando repasse — cobrar o <b>Ed</b>.</div>`;
    else if (/^3\./.test(est)) h += `<div class="gargalo"><b>Atenção:</b> repassado ao Luccas, aguardando O.S. elétrica — cobrar o <b>Luccas</b>.</div>`;
  }
  h += kv("Data visita", data(d.dataVisita));
  h += kv("Data estudo (Ed)", data(d.dataEstudo));
  h += kv("Data repasse (Luccas)", data(d.dataRepasse));
  h += kv("Data O.S. elétrica", data(d.dataOsEletrica));
  h += kv("Responsável", txt(d.responsavel));
  if (d.obs) h += kv("Observação", d.obs);
  return h;
}

function blocoOS(sge){
  const lista = OS[sge] || [];
  let h = `<div class="sect">Ordens de serviço (${lista.length})</div>`;
  if (!lista.length) return h + `<div class="empty">Nenhuma O.S. cadastrada para esta escola.</div>`;
  for (const o of lista) {
    const atras = (o.diasEstagio != null && o.diasEstagio > LIMITE_DIAS_OS);
    h += `<div class="os-card">
      <div class="os-top">
        <span class="os-num">${txt(o.numero)}</span>
        <span class="os-tipo">${txt(o.tipo)}${o.responsavel ? " · " + o.responsavel : ""}</span>
      </div>
      <div class="os-meta">
        <span>Estágio: <b>${o.estagio || "—"}</b></span>
        ${o.diasEstagio != null ? `<span class="${atras?"vermelho":""}">${o.diasEstagio} dias no estágio${atras?" ⚠":""}</span>` : ""}
        ${o.valor != null ? `<span>${moeda(o.valor)}</span>` : ""}
        ${o.prioridade ? `<span>Prioridade: ${o.prioridade}</span>` : ""}
      </div>
      ${o.obs ? `<div class="os-meta">${o.obs}</div>` : ""}
    </div>`;
  }
  return h;
}

function blocoExecucao(sge){
  const lista = EXECUCAO[sge] || [];
  let h = `<div class="sect">Execução · custos (foco do Paço)</div>`;
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
        ${x.equipe ? kv("Equipe", x.equipe) : ""}
        ${(x.inicio||x.fim) ? kv("Início → Fim", `${data(x.inicio)} → ${data(x.fim)}`) : ""}
      </div>
    </div>`;
  }
  return h;
}

function abreFicha(sge){
  const e = ESCOLAS.find(x => x.sge === sge); if (!e) return;
  const b = bucket(e.status);
  document.getElementById("dr-sge").textContent = `SGE ${e.sge} · ${e.tipo || ""}`;
  document.getElementById("dr-nome").textContent = e.nome || "";
  const st = document.getElementById("dr-status");
  st.textContent = e.status || "0. A INICIAR";
  st.className = "st " + STCLS[b];

  let h = `<div class="sect">Cadastro</div>`;
  h += kv("Regional", txt(e.regional));
  h += kv("Distrito", txt(e.distrito));
  h += kv("Bairro", txt(e.bairro));
  h += kv("Território", txt(e.territorio));
  h += kv("Etapa", txt(e.etapa));
  h += kv("Nº de salas", txt(e.salas));
  h += kv("Subestação", `${txt(e.subestacao)}${e.potenciaSub ? " · " + e.potenciaSub : ""}`);
  if (e.endereco) h += kv("Endereço", e.endereco);

  h += `<div class="sect">Valores de adequação</div>`;
  h += kv("Adeq. civil", moeda(e.valorCivil));
  h += kv("Adeq. elétrica", moeda(e.valorEletrica));
  h += kv("Total adequação", moeda(e.valorTotal));
  if (e.asCivil) h += kv("Nº A.S. civil", e.asCivil);
  if (e.asEletrica) h += kv("Nº A.S. elétrica", e.asEletrica);

  h += blocoDiagnostico(sge);
  h += blocoOS(sge);
  h += blocoExecucao(sge);

  document.getElementById("dr-body").innerHTML = h;
  document.getElementById("drawer").classList.add("on");
  document.getElementById("scrim").classList.add("on");
  document.getElementById("drawer").setAttribute("aria-hidden", "false");
}

function fechaFicha(){
  document.getElementById("drawer").classList.remove("on");
  document.getElementById("scrim").classList.remove("on");
  document.getElementById("drawer").setAttribute("aria-hidden", "true");
}

// ---------- init ----------
function init(){
  preparaCoordenadas(ESCOLAS);
  montaDrill();
  montaChipsRegional(ESCOLAS);
  preencheSelect("sel-distrito", new Set(ESCOLAS.map(e => e.distrito)));
  preencheSelect("sel-bairro", new Set(ESCOLAS.map(e => e.bairro)));
  preencheSelect("sel-status", new Set(ESCOLAS.map(e => e.status)));

  ["sel-distrito","sel-bairro","sel-status"].forEach(id =>
    document.getElementById(id).addEventListener("change", aplicaFiltros));
  document.getElementById("f-limpar").addEventListener("click", () => {
    regionalAtiva = "all";
    document.querySelectorAll("#f-regional button").forEach((b,i) => b.classList.toggle("on", i===0));
    ["sel-distrito","sel-bairro","sel-status"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("q").value = "";
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
  document.getElementById("scrim").addEventListener("click", fechaFicha);
  document.addEventListener("keydown", e => { if (e.key === "Escape") fechaFicha(); });

  const nota = document.getElementById("sem-coord");
  const avisos = [];
  if (nCentroide) avisos.push(`${nCentroide} por centroide de bairro`);
  if (SEM_COORD.length) avisos.push(`${SEM_COORD.length} sem posição`);
  nota.textContent = avisos.length ? ` · ${avisos.join(", ")}` : "";
  aplicaFiltros();
}

init();
