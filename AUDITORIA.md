# AUDITORIA VISUAL — Portal de Climatização × Portal da Educação (SME Fortaleza)

> Gerado em 2026-06-15. Leitura/extração apenas — **nenhum arquivo do portal foi alterado**.
> Objetivo: levantar a identidade visual oficial (fontes, cores, botões) do Portal da Educação
> para alinhar o Portal de Climatização à paleta institucional da PMF/SME.

---

## PARTE A — Portal da Educação (referência externa)

- **URL:** https://educacao.sme.fortaleza.ce.gov.br/
- **Stack:** WordPress 7.0 + tema **Blocksy** 2.1.44 (HTTP 200; HTML ≈ 167 KB).
- **CSS analisado:**
  - `wp-content/uploads/blocksy/css/global.css` (CSS dinâmico do tema — **contém a paleta e os tokens**)
  - `wp-content/themes/blocksy/static/bundle/main.min.css` (bundle do tema)
  - estilos inline: `global-styles-inline-css`, `ct-main-styles-inline-css`, `wp-custom-css`

### 1. Fontes (URLs)
| Fonte | Origem | Uso |
|---|---|---|
| **Montserrat** (400, 500, 600, 700) | `https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap` | **fonte principal** de todo o texto |
| Font Awesome 6.7.2 | `https://use.fontawesome.com/releases/v6.7.2/css/all.css` (+ `v4-shims.css`) | ícones |
| `stars.woff2` | `@font-face` em `main.min.css` (`../fonts/stars.woff2`) | ícone de estrelas (avaliação), não é texto |
| dns-prefetch | `//fonts.googleapis.com`, `//use.fontawesome.com` | — |

### 2. font-family aplicado
- **Corpo de texto:** `Montserrat, Sans-Serif` (token `--theme-font-family`).
- **Nav:** herda `Montserrat` (sem família própria).
- **Títulos (h1/h2):** `Montserrat` (headings usam a fonte do tema). Cor dos títulos = `--theme-heading-color` / `--theme-headings-color` = **#f15a22** (laranja).
- _Observação:_ aparece `--theme-font-family:Helvetica` como **fallback/default** do tema, sobrescrito por Montserrat.

### 3. Cores principais (hex)
**Paleta do tema (Blocksy `--theme-palette-color-*`):**
| Token | Hex | Papel |
|---|---|---|
| color-1 | **#f15a22** | laranja — **primária** (botões, títulos, destaque) |
| color-2 | #000000 | preto |
| color-3 | #000000 | preto — texto |
| color-4 | **#f15a22** | laranja — **links** |
| color-5 | **#15c8b4** | teal — bordas/realce |
| color-6 | #15c8b4 | teal |
| color-7 | #ffffff | branco — fundo |
| color-8 | #f8f8f8 | cinza muito claro — fundo de seções |

- **Header:** fundo **branco (#ffffff)**; texto/nav em preto (#000) com destaque laranja.
- **Links:** inicial varia por contexto — **#f15a22** (laranja), **#15c8b4** (teal) ou **#009889** (teal escuro); _active_ #009889 / #15c8b4; _hover_ #000000 ou #ffffff.
- **Texto do corpo:** `rgba(0,0,0,0.65)` (preto a 65%).
- **Rodapé:** sem variável de cor exposta no CSS do tema (definido por bloco/seção); cores neutras observadas: branco/preto.
- **Hex mais frequentes no `global.css`:** #ffffff (10×), #000000 (7×), #f15a22 (3×), #009889 (3×), #15c8b4 (2×), #fd591d, #f8f8f8, #f1f1f1, #eeeeee, #64a9a4.

### 4./5. Estilo dos botões
| Propriedade | Valor |
|---|---|
| fundo (inicial) | **#f15a22** (`color-1`) / variante **#fd591d** |
| fundo (hover) | `color-1` (#f15a22) ou `color-2` (#000) |
| texto | **#ffffff** (inicial); `rgba(255,255,255,.7)` em variações |
| borda | **none** |
| **raio de borda** | `var(--theme-form-field-border-radius, 3px)` → **3px** (default do tema) |
| **padding** | **5px 20px** |
| min-height | 40px |
| fonte | Montserrat, **15px**, peso **500** |
| sombra / transform | none / none |

> **Resumo da identidade PMF/SME:** **Montserrat** + **laranja `#f15a22`** (primária) e **teal `#15c8b4` / `#009889`** (secundária), sobre neutros branco/preto/cinza-claro. Botões laranja, texto branco, cantos suaves (3px), sem borda.

---

## PARTE B — Portal de Climatização (código atual)

### 6. Árvore `web/` (frontend)
```
web/
├── index.html              # estrutura da página (single page)
├── styles.css              # CSS principal (todo o visual)
├── app.js                  # toda a lógica (mapa, ficha, filtros, funil, balão)
└── data/
    ├── dados.js            # ESCOLAS / EXECUCAO / DIAGNOSTICO / OS (base principal)
    ├── bairros.js          # geojson bairros
    ├── bairros_areas.js    # geojson áreas de bairro
    ├── distritos.js        # geojson distritos
    ├── regionais.js        # geojson regionais
    ├── subestacao.js       # dados de subestação por SGE
    ├── mapa_sub.js          # SGE → CATEGORIA (mapa de subestação)
    ├── salas_prof.js        # SGE → status da sala dos professores (rosca de salas)
    └── etapa02.js           # SGE → status instalação etapa 02 (fantasma da rosca)
```
_(não há build/bundler; tudo é carregado direto por `<script>`/`<link>`.)_

### 7. Onde estão cores e fontes hoje
**Tudo em `web/styles.css`, em dois blocos `:root` no topo:**
- **Paleta base** (`:root`, linhas 1–5): `--bg #F4F1EA`, `--panel #FBFAF6`, `--ink #1C1B19`, `--ink2`, `--line`, `--laranja #E0612B`, `--azul #1F6F9E`, `--verde #3F9A52`, `--verde2 #6FB97C`, `--cinza #A9A296`, `--vermelho #C0432E`, `--amarelo #E2A030`, `--roxo #7C5BA6`.
- **Design tokens** (2º `:root`, linhas 11+): fontes `--fonte-ui:'Inter'` e `--fonte-marca:'Fraunces'`; cores de período `--cor-antes-2025`, `--cor-2025`(verde), `--cor-2026`(azul), `--cor-futuras`; raios `--raio-botao:8px`, `--raio-card:14px`; `--sombra-leve`; pesos 400/500/600/700.

**Fontes carregadas** (Google Fonts) em `web/index.html` **linha 11**: Archivo, **Fraunces**, **Inter**, Spline Sans Mono. Hoje a interface usa **Inter** (`--fonte-ui`) e só o título principal usa **Fraunces** (`--fonte-marca`).

> Contraste com a referência: o portal usa **Inter/Fraunces** e laranja **#E0612B** + azul/verde; a PMF usa **Montserrat** e laranja **#f15a22** + teal **#15c8b4**.

### 8. CSS principal e como é carregado
- **Arquivo:** `web/styles.css` (único CSS do portal).
- **Carregamento:** `web/index.html` **linha 12** → `<link rel="stylesheet" href="styles.css" />`.
- Também carrega o CSS do **Leaflet** (externo) na linha 7 e as Google Fonts na linha 11.

### 9. Onde estão os elementos-chave
| Elemento | HTML (`index.html`) | CSS (`styles.css`) |
|---|---|---|
| **Cabeçalho / título** | `<header class="top">` L16; `<h1>Climatização Escolar … Fortaleza</h1>` L19 | `header.top` L51; `h1` L55 (usa `--fonte-marca`/Fraunces); `h1 .thin` L56 (itálico laranja) |
| **Régua tricolor** | `<div class="faixa"><i><i><i></div>` L24 | `.faixa` L60; faixas L62–64 → **laranja / azul / verde** (`nth-child 1/2/3`) |
| **Cards de número (balão)** | `<div class="cardstrip" id="cardstrip">` L114 (4 seções) | `.cardstrip` L168; `.metricard` L173 (listra de cor no topo) |
| **Cards de número (KPIs)** | `<div class="kpis" id="kpis">` L159 (6 KPIs) | `.kpi` L443; `.kpi-val` (números grandes) |
| **Tabela de unidades** | `.tablecard` L162; `<table>` L171; `<th>` L173; `<tbody id="tbody">` L175 | `.tablecard table` / `.pill` nas células de status |
| **Botões / pills** | pills de status na lista; chips de período `#f-periodo`; toggle `.dm`; atalhos `.db`; funil `#funil`; chips de situação `#smf-list` | `.pill` L533 (+ `.p-clim` L535 etc., pílula 20px); `.chiprow button` L80; `.btn-limpar` L105; `.dm` L351; `.db` L381; `.fbar` L462; `.smf-chip` L283 |

---

## RESUMO

**Parte A (referência PMF/SME):** site WordPress/Blocksy com **fonte Montserrat** e paleta institucional **laranja `#f15a22`** (primária, links, títulos, botões) + **teal `#15c8b4` / `#009889`** (secundária), sobre branco/preto/cinza-claro. Botões: fundo laranja, texto branco, **sem borda**, **raio 3px**, **padding 5px 20px**, Montserrat 15px/500.

**Parte B (portal atual):** SPA estático sem build. Todo o visual em **`web/styles.css`** (carregado em `index.html` L12), com a paleta e os tokens em dois `:root` no topo; fontes **Inter** (interface) + **Fraunces** (só o título), carregadas via Google Fonts (`index.html` L11). Estrutura: título L16–19, régua tricolor L24 (laranja/azul/verde), cards de número no balão (`#cardstrip` L114) e nos KPIs (`#kpis` L159), tabela de unidades (`.tablecard` L162) e pills/botões espalhados (`.pill`, `.chiprow button`, `.dm`, `.db`, `.fbar`, `.smf-chip`).

**Gaps para alinhar à PMF (quando for aprovado mexer):**
1. Fonte de interface **Inter → Montserrat** (manter ou rever a serifada do título).
2. Laranja **#E0612B → #f15a22**; introduzir o **teal #15c8b4** como cor secundária/destaque.
3. Régua tricolor e listras dos cards podem adotar laranja + teal institucionais.
4. Raio/padding dos botões já são próximos (portal 8px vs PMF 3px — decisão de marca).
