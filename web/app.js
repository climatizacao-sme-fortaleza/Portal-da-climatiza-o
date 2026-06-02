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
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18, attribution: "&copy; OpenStreetMap"
}).addTo(map);
const layer = L.layerGroup().addTo(map);

// ---------- camadas de areas (distritos / regionais) ----------
// panes proprios, abaixo dos pontos e sem capturar cliques (pra nao bloquear as escolas)
map.createPane("paneDistritos");
map.getPane("paneDistritos").style.zIndex = 350;          // overlayPane (pontos) = 400
map.getPane("paneDistritos").style.pointerEvents = "none";
map.createPane("paneRegionais");
map.getPane("paneRegionais").style.zIndex = 350;
map.getPane("paneRegionais").style.pointerEvents = "none";

const distritosLayer = L.geoJSON(window.DISTRITOS || null, {
  pane: "paneDistritos",
  style: f => ({
    color: f.properties.cor, weight: 1.5, opacity: .85,
    fillColor: f.properties.cor, fillOpacity: .18
  })
});
const regionaisLayer = L.geoJSON(window.REGIONAIS || null, {
  pane: "paneRegionais",
  style: f => ({
    color: f.properties.cor, weight: 1.2, opacity: .85,
    fillColor: f.properties.cor, fillOpacity: .40
  })
});

function montaControleAreas() {
  const ctrl = L.control({ position: "topright" });
  ctrl.onAdd = function () {
    const div = L.DomUtil.create("div", "map-toggle");
    div.innerHTML =
      `<label><input type="checkbox" id="tg-distritos" checked> Distritos</label>` +
      `<label><input type="checkbox" id="tg-regionais"> Regionais</label>`;
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  ctrl.addTo(map);
  distritosLayer.addTo(map); // distritos visivel por padrao; regionais comeca desligada
  const cbD = document.getElementById("tg-distritos");
  cbD.addEventListener("change", () => {
    if (cbD.checked) distritosLayer.addTo(map); else map.removeLayer(distritosLayer);
  });
  const cbR = document.getElementById("tg-regionais");
  cbR.addEventListener("change", () => {
    if (cbR.checked) regionaisLayer.addTo(map); else map.removeLayer(regionaisLayer);
  });
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
  montaControleAreas();
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
    aplicaFiltros();
  });
  document.getElementById("q").addEventListener("input", renderLista);
  document.getElementById("dr-close").addEventListener("click", fechaFicha);
  document.getElementById("scrim").addEventListener("click", fechaFicha);
  document.addEventListener("keydown", e => { if (e.key === "Escape") fechaFicha(); });

  const nota = document.getElementById("sem-coord");
  nota.textContent = ` · ${nGeo} com ponto exato` +
    (nCentroide ? `, ${nCentroide} por centroide de bairro` : "") +
    (SEM_COORD.length ? `, ${SEM_COORD.length} sem posição` : "");
  aplicaFiltros();
}

init();
