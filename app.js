// Portal da Climatizacao Escolar - Camada 1 (Mapa)
// Le os dados (data/escolas.js), posiciona por centroide de bairro e
// colore por STATUS GERAL em 4 categorias.

const DOTCOL = { clim:"#3F9A52", parc:"#6FB97C", pipeline:"#E2A030", iniciar:"#A9A296" };
const STCLS  = { clim:"st-clim", parc:"st-parc", pipeline:"st-pipe", iniciar:"st-init" };

// Mapeia o status da regua macro nas 4 categorias de cor.
function bucket(status) {
  const s = (status || "0. A INICIAR").trim();
  if (s === "9. CLIMATIZADA") return "clim";
  if (s === "10. CLIMATIZADA PARCIAL") return "parc";
  if (s === "0. A INICIAR") return "iniciar";
  return "pipeline"; // estagios 1 a 6
}

const map = L.map("map", { scrollWheelZoom: false }).setView([-3.768, -38.545], 11.4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18, attribution: "&copy; OpenStreetMap"
}).addTo(map);
const layer = L.layerGroup().addTo(map);

let TODAS = [];      // escolas com coordenada
let SEM_COORD = [];  // bairro fora do dicionario de centroides

// Espalha deterministicamente varias escolas do mesmo bairro ao redor do centroide.
function jitter(base, i, total) {
  if (total <= 1) return base;
  const raio = 0.0042; // ~470 m
  const ang = (2 * Math.PI * i) / total;
  const r = raio * (0.35 + 0.65 * ((i % 3) / 2));
  return [base[0] + r * Math.cos(ang), base[1] + r * Math.sin(ang) * 0.85];
}

function fmtMoeda(v) {
  if (v === null || v === undefined || v === "" ) return "—";
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  if (isNaN(n) || n === 0) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function popupHtml(e) {
  const b = bucket(e.status);
  return `<div class="popup-escola">
    <div class="sge">SGE ${e.sge} · ${e.tipo || ""}</div>
    <h3>${e.nome}</h3>
    <span class="st ${STCLS[b]}">${e.status || "0. A INICIAR"}</span>
    <dl>
      <dt>Regional</dt><dd>${e.regional || "—"}</dd>
      <dt>Distrito</dt><dd>${e.distrito || "—"}</dd>
      <dt>Bairro</dt><dd>${e.bairro || "—"}</dd>
      <dt>Salas</dt><dd>${e.salas ?? "—"}</dd>
      <dt>Subestação</dt><dd>${e.subestacao || "—"}</dd>
      <dt>Valor adeq.</dt><dd>${fmtMoeda(e.valorTotal)}</dd>
    </dl>
  </div>`;
}

function preencheSelect(id, valores, ordenarNum) {
  const sel = document.getElementById(id);
  const arr = [...valores].filter(v => v !== null && v !== undefined && v !== "");
  arr.sort(ordenarNum ? (a, b) => Number(a) - Number(b)
                      : (a, b) => String(a).localeCompare(String(b), "pt-BR"));
  for (const v of arr) {
    const o = document.createElement("option");
    o.value = v; o.textContent = v;
    sel.appendChild(o);
  }
}

let regionalAtiva = "all";

function montaChipsRegional(escolas) {
  const regs = ["all", ...[...new Set(escolas.map(e => e.regional))]
    .sort((a, b) => Number(a) - Number(b))];
  const box = document.getElementById("f-regional");
  box.innerHTML = regs.map((r, i) =>
    `<button class="${i === 0 ? "on" : ""}" data-r="${r}">${r === "all" ? "Todas" : "R" + r}</button>`
  ).join("");
  box.querySelectorAll("button").forEach(b => b.onclick = () => {
    box.querySelectorAll("button").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    regionalAtiva = b.dataset.r;
    aplicaFiltros();
  });
}

function aplicaFiltros() {
  const fd = document.getElementById("sel-distrito").value;
  const fb = document.getElementById("sel-bairro").value;
  const fs = document.getElementById("sel-status").value;

  layer.clearLayers();
  let n = 0;
  for (const e of TODAS) {
    if (regionalAtiva !== "all" && String(e.regional) !== regionalAtiva) continue;
    if (fd && String(e.distrito) !== fd) continue;
    if (fb && e.bairro !== fb) continue;
    if (fs && e.status !== fs) continue;
    const m = L.circleMarker(e._latlng, {
      radius: 5, weight: 1.4, color: "rgba(0,0,0,.35)",
      fillColor: DOTCOL[bucket(e.status)], fillOpacity: .9
    });
    m.bindPopup(popupHtml(e));
    layer.addLayer(m);
    n++;
  }
  document.getElementById("contagem").textContent = n;
}

function init(escolas) {
  const porBairro = {};
  for (const e of escolas) (porBairro[e.bairro] = porBairro[e.bairro] || []).push(e);
  for (const [bairro, lista] of Object.entries(porBairro)) {
    const base = window.BAIRRO_CENTROIDES[bairro];
    if (!base) { SEM_COORD.push(...lista); continue; }
    lista.forEach((e, i) => { e._latlng = jitter(base, i, lista.length); TODAS.push(e); });
  }

  montaChipsRegional(escolas);
  preencheSelect("sel-distrito", new Set(escolas.map(e => e.distrito)), false);
  preencheSelect("sel-bairro", new Set(escolas.map(e => e.bairro)), false);
  preencheSelect("sel-status", new Set(escolas.map(e => e.status)), false);

  ["sel-distrito", "sel-bairro", "sel-status"].forEach(id =>
    document.getElementById(id).addEventListener("change", aplicaFiltros));
  document.getElementById("f-limpar").addEventListener("click", () => {
    regionalAtiva = "all";
    document.querySelectorAll("#f-regional button").forEach((b, i) =>
      b.classList.toggle("on", i === 0));
    ["sel-distrito", "sel-bairro", "sel-status"].forEach(id =>
      document.getElementById(id).value = "");
    aplicaFiltros();
  });

  if (SEM_COORD.length) {
    document.getElementById("sem-coord").textContent =
      ` · ${SEM_COORD.length} sem coordenada`;
  }
  aplicaFiltros();
}

if (window.ESCOLAS && Array.isArray(window.ESCOLAS)) {
  init(window.ESCOLAS);
} else {
  fetch("data/escolas.json").then(r => r.json()).then(init).catch(err => {
    document.getElementById("map").innerHTML =
      `<p style="padding:20px">Erro ao carregar dados: ${err}.</p>`;
  });
}
