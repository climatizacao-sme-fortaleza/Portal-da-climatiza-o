# ANTES → DEPOIS — Identidade institucional PMF/SME no Portal de Climatização

> Aplicado em 2026-06-15. **Só aparência** — nenhuma classe/id renomeada, nenhuma
> lógica/dados/filtro/Leaflet alterado. Backups: `web/styles.css.bak`, `web/index.html.bak`.

## Arquivos
| Ação | Arquivo |
|---|---|
| Backup | `web/styles.css.bak`, `web/index.html.bak` (novos) |
| Copiado | `fortaleza-design-system.css` → **`web/fortaleza-design-system.css`** |

## web/index.html
| Item | Antes | Depois |
|---|---|---|
| Fontes (L11) | Archivo + Fraunces + Inter + Spline Sans Mono | **Montserrat** 400;500;600;700;800 (só) |
| Link CSS (L12) | — | **+ `<link ... fortaleza-design-system.css>`** antes do `styles.css` |
| Rodapé | — | **+ `<footer class="fz-footer">`** (novo): brasão placeholder + endereço SME |

## web/styles.css — paleta base (`:root`)
| Variável | Antes | Depois |
|---|---|---|
| `--bg` | #F4F1EA | **#FFFFFF** |
| `--panel` | #FBFAF6 | **#FFFFFF** |
| `--laranja` | #E0612B | **#F15A22** |
| `--azul` | #1F6F9E | **#00A0DC** |
| `--verde` | #3F9A52 | **#009889** |
| `--verde2` | #6FB97C | #6FB97C (mantido — "parcial") |
| ink / ink2 / line / cinza / vermelho / amarelo / roxo | — | mantidos |

## web/styles.css — design tokens (`:root`)
| Variável | Antes | Depois |
|---|---|---|
| `--fonte-ui` | 'Inter' | **'Montserrat'** |
| `--fonte-marca` | 'Fraunces', serif | **'Montserrat'** |
| `--cor-2025` | #3F9A52 | **#009889** (verde institucional) |
| `--cor-2026` | #1F6F9E | **#00A0DC** (azul institucional) |
| `--raio-botao` | 8px | **3px** (padrão Educação) |

## web/styles.css — fontes literais
- **~11×** `font-family:'Inter',…` → **`var(--fonte-ui)`** (passam a ser Montserrat). Afetou `.cardstrip`, `.mapnav`, `.metricard .mc-*`, `.mini-donut-num`, `.mc-anos b`, `.mc-unit`, `.mc-tipo-top b`, `.drill-lab/.dm/.drill-voltar/.drill-trilha/.db`.

## web/styles.css — cabeçalho (masthead) e régua
| Seletor | Antes | Depois |
|---|---|---|
| `header.top` | borda inferior 2px ink + padding-bottom 16px | **faixa laranja** (`background:var(--laranja)`, `color:#fff`, `margin:-28px -22px 0`, `padding:30px 22px 22px`) |
| `.eyebrow` | cor `--ink2` | **rgba(255,255,255,.85)** + weight 600 |
| `h1` | weight 700 | **weight 800 + `color:#fff`** |
| `h1 .thin` | italic + cor `--laranja` | **`color:#fff`, sem itálico** |
| `.sub` | cor `--ink2` | **rgba(255,255,255,.9)** |
| `.badge` | borda `--ink` | **borda rgba(255,255,255,.7) + `color:#fff`** |
| `.faixa` | height 5px, margin 14/0/26 | **height 6px, margin 0 -22px 26px** (cola na masthead, full-bleed) |
| `.faixa i:nth 1/2/3` | laranja/azul/verde (via vars) | mesmas vars → agora **#F15A22 / #00A0DC / #009889** |

## web/styles.css — números grandes em petróleo (novo bloco no fim)
- `color:#325565` em: `.kpi-val, .mc-num, .ctx-mval, .fbar-num, .smf-n, .subc b, .mc-tipo-top b, .fl-dist-n, .ft-num`.
- `fill:#325565` em: `.ctx-donut-num, .mini-donut-num` (textos SVG das roscas).

## web/styles.css — toggles/pills ativos em petróleo (novo bloco no fim)
- `background/border:#325565; color:#fff` em: `.chiprow button.on`, `#f-periodo button.on[data-p="all"]` (chip "Todos"), `.dm.on` (toggle Distritos/Regionais), `.db.on` (atalhos), `.smf-todas-chip.sel` ("Todas as situações").
- Chips de período **2025 / 2026** mantêm a cor do período (agora verde/azul institucionais via vars).

## web/styles.css — status pills da tabela
| Classe (status) | Antes | Depois |
|---|---|---|
| `.p-clim` (climatizada) | #E4F1E5 / #2C6B39 | **verde #009889** (bg/texto/borda translúcidos; texto #00766A) |
| `.p-parc` (parcial) | #EAF3EB / #3F7A4A | **#6FB97C** (texto #2F7A57) |
| `.p-pipe` (em execução) | #FBF0D9 / #9A6B12 | **laranja #F15A22** (texto #C8430F) |
| `.p-init` (a iniciar) | #EDEAE2 / #6B655A | **cinza neutro** (texto #6B6660) |

## web/styles.css — rodapé (novo CSS no fim)
- `.fz-brasao`, `.fz-brasao-ph` (placeholder do brasão horizontal, contorno branco), `.fz-brasao-tag`, `.fz-end` (endereço, texto branco).

## Elementos novos adicionados
1. `web/fortaleza-design-system.css` — tokens/classes institucionais (`--fz-*`, `.fz-footer`, etc.), importado no `index.html`.
2. `<footer class="fz-footer">` no fim do `index.html` — faixa laranja com **brasão (placeholder)** + endereço da SME.

## O que NÃO foi tocado (regras de ouro)
- Nenhuma classe/id renomeada (app.js intacto).
- `app.js`, dados (`web/data/*`), filtros, drill e o **mapa Leaflet** (incl. cores dos pontos `DOTCOL`) **inalterados**.
- Verde-2 (parcial), tipografia de corpo e a estrutura do DOM preservados.

## Pendências / observações
- **Brasão:** está como **placeholder** ("FORTALEZA PREFEITURA"). Substituir pelo SVG/PNG oficial (lockup horizontal) quando a Comunicação da SME enviar.
- **Cores dos pontos do mapa** seguem a paleta antiga (constraint "não tocar no Leaflet"); se quiser alinhar ao institucional, é uma troca separada em `app.js` (`DOTCOL`).
- Validado a 1366×768: Montserrat, masthead laranja, tricolor institucional, números petróleo, footer, mapa/submapa/funil intactos, sem erro de console, sem scroll horizontal.

---

# AJUSTES FINOS (rodada 2) — 2026-06-16

> Só aparência; sem renomear classe/id; sem tocar em lógica/dados/filtros/Leaflet.
> Diffs mostrados por arquivo contra snapshot da rodada. Novo: pasta `web/assets/`.

## 1) Rodapé (footer) — minimalista
| Item | Antes | Depois |
|---|---|---|
| Endereço "Rua do Rosário / educacao.sme…" | presente (`<address class="fz-end">`) | **removido por completo** (era cópia do site da Educação) |
| Brasão | placeholder em **caixa com borda** (`FORTALEZA` + `PREFEITURA`) | **placeholder tipográfico limpo, sem caixa**: `.fz-brasao-cidade` "FORTALEZA" (Montserrat 800) + `.fz-brasao-pref` "Prefeitura" (caixa alta, `letter-spacing .34em`), ambos brancos |
| Linha institucional | "Secretaria Municipal da Educação · SME" | mantida (`.fz-brasao-tag`) |
| Direita | endereço/site | **linha discreta** `.fz-fonte`: "Fonte dos dados: COINF · Secretaria Municipal da Educação" |
| Imagem oficial | — | comentário pronto no HTML p/ trocar por `<img src="assets/brasao-branco.svg" class="fz-brasao-img">`; CSS `.fz-brasao-img{height:46px}` já definido |
| CSS removido | `.fz-end` | — |

## 2) Cabeçalho (masthead) — mais limpo
| Item | Antes | Depois |
|---|---|---|
| Parágrafo `.sub` | **dentro** da faixa laranja (branco) | **movido para fora**, logo **abaixo da régua tricolor** |
| `.sub` estilo | `color:rgba(255,255,255,.9); font-size:14px` | **`color:var(--ink2)` (grafite/cinza), `font-size:13px`, discreto** |
| `.faixa` margin-bottom | 26px | **14px** (a nota agora ocupa o espaço seguinte) |

## 3) Títulos de seção — mais destaque (consistente em todos)
`.maphead h2` e `.tabhead h2` ("Mapa do Parque Escolar", "Mapa da subestação…", "Panorama do parque", "Buscar unidade"):
| Propriedade | Antes | Depois |
|---|---|---|
| peso | 600 (maphead) / normal (tabhead) | **700** |
| cor | `--cinza` / `--ink2` (apagado) | **petróleo #325565** |
| acento | — | **barra laranja `var(--laranja)` 4px à esquerda + `padding-left:10px`** |
| letter-spacing | .07em / .1em | **.07em** (unificado) |

## 4) Renomear
- `index.html`: **"Mapa do parque" → "Mapa do Parque Escolar"** (só o texto visível; id/classe intactos).

## Arquivos / elementos novos
- **`web/assets/`** (criada) + `web/assets/LEIA-ME.txt` (instrução do brasão).
- Footer: spans `.fz-brasao-cidade`, `.fz-brasao-pref`, `.fz-fonte`; CSS `.fz-brasao-img` (para o SVG oficial).

## Brasão oficial — pendência
- A arte oficial do lockup **FORTALEZA / PREFEITURA** foi recebida (versão **colorida/positiva**, para fundo claro).
- Para o rodapé (faixa **laranja**) o ideal é a **versão branca (flat)**, conforme o manual. Falta o arquivo vetorial branco.
- **Ação:** colocar o arquivo em **`web/assets/brasao-branco.svg`** (ou `.png`) e, no `index.html`, trocar o placeholder pelo `<img>` já comentado. O CSS (`.fz-brasao-img`) e a estrutura já estão prontos — é só inserir o arquivo. (Regra de ouro: não recriar o escudo à mão; usar só o vetor oficial.)

---

# CORREÇÕES FUNCIONAIS (rodada 3) — 2026-06-16

> Backups `.bak` (estado pré-rodada) de `app.js`, `index.html`, `styles.css`. Mapa Leaflet
> não foi tocado/quebrado; nenhum id/classe-hook renomeado. Identidade PMF mantida.

## 1) Roscas cortando o % central
- `.ctx-donut` e `.mini-donut` → **`overflow:visible`** (texto central nunca é cortado).
- Mini Salas: fonte do % **10 → 9** e `y 24 → 23.5` (folga no furo). Validado em Fortaleza e distrito.

## 2) Cobertura e Climatizadas por tipo — cumulativas com denominador fixo
- **Denominadores** (total de bairros, escolas, CEIs, unidades) agora vêm do **`baseGeo`** (território
  inteiro, todos os períodos) → **fixos** no filtro de período; ao entrar em distrito/regional, viram
  os totais daquele território.
- **Numeradores** (cobertos, climatizados por tipo) vêm do **`baseBalao`** (acumulado até o período).
- Fortaleza: denominadores sempre **103 bairros / 512 unid / 322 escolas / 190 CEIs**; numeradores
  somam antes→2025→2026.

## 3) Card Salas Climatizadas
- Removida a nota **"+ N previstas (etapa 02)"** (`.mc-prev`) — informação interna. (A faixa
  transparente da rosca foi mantida; remoção dela é trivial se quiserem.)

## 4) Salas de 2025
- **Sem alteração** (decisão adiada, conforme pedido).

## 5) Funil — sub-lista com UX melhor
- Tag de cada unidade mostra a **CATEGORIA do funil** (ex.: "A iniciar"), não o estágio detalhado
  (`statusLabel` → `BUCKET_LABEL[k]`; novo mapa `BUCKET_LABEL`).
- Cabeçalho **"FUNIL › Categoria"** + chip de contagem; botão **"← Fechar"** explícito; **linha de
  ajuda** ("Você abriu a sub-lista da faixa X…"). Estilo PMF (faixa creme, acento laranja, petróleo).

## 6) Panorama do Parque — 6 → 4 cards
- Removidos **"Investido · execução"** e **"Represa · sem subestação"**. Sobram **Climatizadas,
  Parciais, Em execução, A iniciar**, numa **única linha** (`.kpis` grid `repeat(3)` → `repeat(4)`).

## 7) Buscar unidade — sempre 512
- `renderLista`: `base = ESCOLAS` (não filtra mais por período/status/território); só a **busca
  textual** filtra. Coluna **Status** passou a mostrar a **categoria do filtro** (`BUCKET_LABEL[b]`),
  não o status cru. Validado: 512 fixo sob filtros; busca "CEI" → 190.

## 8) Subestação — consolidada + renomeada + ícones
- **Consolidação:** os 3 contadores (`.sub-counters`) + a legenda de baixo (`#sublegend`) viraram um
  **único bloco no topo** (`#sub-cats`) com as **5 categorias** (ícone + contagem + rótulo), recalculado
  com período/território.
- **Renomeações** (só estas 3): Falta estudo elétrico → **Aguardando estudo elétrico**; Liberada →
  **Apta, sem aumento ou implantação de Subestação**; Climatizada → **Concluída**.
- **Ícones SVG distintos por categoria** (não bolinhas iguais): raio (nova), seta subindo (aumento),
  relógio (aguardando), escudo-check (apta), círculo-check (concluída) — `currentColor` na cor da
  categoria. Cores dos pontos do mapa **mantidas** (Leaflet não tocado).

## Novos hooks/classes (presentacionais; nenhum renomeado)
- `BUCKET_LABEL` (app.js); `#sub-cats` + `.sub-cat*` (bloco subestação); `.fl-bc*`, `.fl-ajuda`,
  `.fl-close` reestilizado (sub-lista do funil). `.sub-counters`/`.sublegend`/`.fl-tot` ficam como
  CSS legado não usado.

---

# Rodada de ajuste — legenda da rosca + ícones de subestação (2026-06-16)

> Só aparência. Backups: `web/app.js.bak`, `web/styles.css.bak`, `web/index.html.bak`.
> Validado: console limpo, sem scroll horizontal, mapas Leaflet intactos.

## A) Legenda da rosca "Avanço" — % não corta mais
- **Sintoma:** a coluna de porcentagem à direita de cada categoria (ex.: "Climatizada 150 29,3%")
  era cortada na borda do painel (`.ctxpanel{overflow:hidden}`) — aparecia "29," e sumia o resto.
- **Causa:** a linha (dot + rótulo "Climatizada" + contagem + %) estourava os ~258px úteis do painel
  de 290px, e o `.lp` (último item, com `min-width:42px`) era o que ficava para fora e era clipado.
- **Correção (CSS, `.ctx-leg`):** cada linha virou **grid de 4 colunas**
  `11px minmax(0,1fr) auto auto` = `dot | rótulo | contagem | %`. Contagem e % são colunas `auto`
  com `white-space:nowrap` → **nunca cortam**; se faltar espaço quem cede é o **rótulo**
  (`minmax(0,1fr)` + ellipsis). Removido o `min-width:42px` do `.lp`.
- **Espaço extra:** rosca `.ctx-donut` 104→**94px** e `gap` do wrap 14→**11px**; fontes da legenda
  12,5→**11,5px** e do `.lp` 10,5→**10px**. Com isso os rótulos cabem inteiros (sem ellipsis).
- **app.js:** o rótulo da legenda passou a vir embrulhado em `<span class="ll">…</span>`
  (única mudança no JS; valores/cálculo idênticos).
- **Validado (Fortaleza):** "Climatizada 150 29,3%", "Parcial 16 3,1%", "A iniciar 346 67,6%" —
  as três % inteiras, nenhuma linha clipada (`lpRight 332 < panelRight 333`).

## B) Ícones das 5 categorias de subestação — silhuetas elétricas (sem bolinhas)
- **Proibido círculo/bolinha como ícone.** Saíram os dois ícones que usavam `<circle>`
  (relógio e círculo-check). Cada categoria ganhou pictograma de silhueta distinto, metáfora de
  energia, `currentColor` na cor da categoria. Cores dos pontos do mapa **mantidas** (Leaflet intacto).

| Categoria | Antes | Depois |
|---|---|---|
| Nova subestação | raio | **torre de energia** (poste/torre) |
| Aumento de carga | seta subindo | **medidor subindo** (mostrador + agulha pra cima) |
| Aguardando estudo elétrico | relógio (círculo) | **prancheta com raio** |
| Apta, sem aumento… | escudo-check | **tomada / plug** |
| Concluída | círculo-check | **selo com check** (selo octogonal) |

- **Validado:** `#sub-cats` sem nenhum `<circle>`; 5 ícones renderizando na cor da categoria
  (72 / 25 / 177 / 90 / 148).

## B.1) Container do ícone — chip quadrado arredondado (acabamento)
- Os 5 pictogramas (torre, medidor, prancheta com raio, tomada, selo com check) ficam **iguais**;
  só ganharam um **container de fundo** para dar unidade.
- **CSS (`.sub-cat-ico`, só estilo):** virou um quadrado de **34×34px**, `border-radius:8px`,
  fundo = **cor da categoria a ~13%** (`color-mix(in srgb, var(--cat) 13%, #fff)`), pictograma
  centralizado e reduzido **24→21px**, na **cor cheia** da categoria (`currentColor=var(--cat)`).
- Fundo propositalmente **discreto** (o símbolo é o protagonista; não vira "bolinha colorida").
  Containers do mesmo tamanho, alinhados, com o mesmo `gap` para o rótulo. Cores das categorias
  e pontos do mapa **inalteradas**.
- **Validado:** 5 chips uniformes 34×34, `radius 8px`, sem `<circle>`, sem scroll horizontal,
  console limpo, mapas Leaflet intactos.

---

# Rodada — restaurar icones antigos + pontos do mapa de subestacao (2026-06-17)

> Backups: `web/app.js.bak2`, `web/styles.css.bak2`, `web/index.html.bak2` (o `.bak` antigo
> foi mantido como referencia dos icones). Validado: mapa renderiza, 512 pontos, clique abre
> ficha, console limpo, sem scroll horizontal, Leaflet intacto.

## Frente 1 — icones do SUBCAT voltaram aos ANTIGOS (commit 8e4c997)
Revertidos os 5 `ico:` para a versao anterior (byte-identica ao `app.js.bak`): **raio** (nova),
**seta subindo** (aumento), **relogio** (aguardando), **escudo com check** (apta), **check em
circulo** (concluida). So o campo `ico` mudou; `cor/r/op/w/lab` e o container-chip (B.1) ficaram
iguais.

## Frente 2 — pontos do 2o mapa (subestacao) mais limpos e legiveis
Continuam **redondos** (nao viraram simbolo). Em `renderMapaSub` o `L.circleMarker` passou a ter:
- **Aro branco fino**: `color:#fff`, `weight:1.5` (antes borda escura `rgba(0,0,0,.32)`).
- **Preenchimento ~85%**: `fillOpacity:.85` fixo (da nocao de densidade na sobreposicao).
- **Sombra leve**: classe `.sub-pt` com `filter:drop-shadow(0 .5px 1px rgba(0,0,0,.28))` — separa
  pontos colados, estilo mapa profissional.
- **Raio menor + cresce com o zoom**: `radius = cfg.r * subScale()`, com `subScale()` de ~0,62
  (afastado) a ~1,12 (aproximado); `mapSub.on("zoomend", ajustaRaioSub)` reescala os pontos
  (guardados em `subMarkers`). Diametro renderizado caiu para ~6-8px (antes ate ~12px), reduzindo
  a "sopa" em zoom afastado. Cores de cada categoria **mantidas**.
