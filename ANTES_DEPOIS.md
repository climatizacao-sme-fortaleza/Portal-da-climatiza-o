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
