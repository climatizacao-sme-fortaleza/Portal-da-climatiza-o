# Portal de Climatização Escolar · Fortaleza

Dashboard estático de acompanhamento da **climatização das unidades escolares da rede
municipal de Fortaleza**, da **Secretaria Municipal da Educação (SME) / COINF**.

Mostra, num mapa interativo (Leaflet) com drill-down (Fortaleza → Distrito → Regional →
Bairro), o status de execução de cada uma das **512 unidades**, além de indicadores de
salas climatizadas, investimento, cobertura, subestação/estudo elétrico e a ficha por
unidade. É 100% **front-end estático**: HTML + CSS + JavaScript puro, sem build nem
framework. Os dados entram como `<script>` que populam variáveis globais (`window.ESCOLAS`,
`window.EXECUCAO`, etc.).

---

## Como rodar localmente

Servidor estático em PowerShell (Windows), porta **8123**:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 8123
```

Depois abra **http://localhost:8123/**.

- `serve.ps1` serve a pasta `web/` (parâmetros: `-Port` padrão 8123, `-Root` padrão `web/`).
- Qualquer servidor estático equivale (ex.: `python -m http.server 8123` dentro de `web/`).
  O importante é servir a pasta `web/` por HTTP — abrir o `index.html` via `file://` quebra
  os `fetch`/carregamentos.
- A configuração de preview do editor está em `.claude/launch.json` (alvo `portal`, porta 8123).

---

## Estrutura de pastas

```
portal/
├── web/                        # a aplicação (tudo que vai pro navegador)
│   ├── index.html              # estrutura da página (single page)
│   ├── styles.css              # CSS principal do portal
│   ├── fortaleza-design-system.css  # tokens/classes institucionais PMF (importado antes do styles.css)
│   ├── app.js                  # toda a lógica (mapa, ficha, filtros, funil, balão, subestação)
│   ├── assets/                 # imagens (ex.: brasão oficial quando chegar)
│   └── data/                   # dados como JS (carregados por <script>)
│       ├── dados.js            # ESCOLAS / EXECUCAO / DIAGNOSTICO / OS (base principal)
│       ├── bairros.js · bairros_areas.js · distritos.js · regionais.js  # geojson (geografia)
│       ├── subestacao.js       # subestação por SGE (ficha)
│       ├── mapa_sub.js         # SGE → CATEGORIA (mapa de subestação)
│       ├── salas_prof.js       # SGE → status da sala dos professores (rosca de salas)
│       └── etapa02.js          # SGE → status instalação etapa 02 (fantasma da rosca)
│
├── serve.ps1                   # servidor estático local (porta 8123)
├── build.ps1                   # gera os web/data/*.js a partir dos CSV/planilhas
├── xlsx2csv.ps1                # converte as planilhas .xlsx em CSV intermediário
├── geocode.ps1                 # geocodifica endereços (Nominatim/OpenStreetMap, sem chave)
├── writeback.ps1               # escreve dados de volta para planilha
│
├── .claude/
│   ├── launch.json             # config de preview (servidor portal:8123)
│   └── skills/identidade-pmf/  # skill da identidade visual PMF/SME (versionada)
│
├── AUDITORIA.md · DESIGN_SYSTEM.md · ANTES_DEPOIS.md  # referência de identidade/mudanças
└── README.md
```

---

## De onde vêm os dados

A fonte primária são **planilhas `.xlsx`** (base da SME/COINF). **Elas NÃO estão no
repositório** — são ignoradas pelo `.gitignore` (`*.xlsx`), por serem arquivos grandes e
de origem externa.

- O fluxo é: `.xlsx` → `xlsx2csv.ps1` / `build.ps1` → **`web/data/*.js`** (versionados).
- **O portal NÃO depende dos `.xlsx` em runtime.** Em produção/navegador ele lê apenas os
  `web/data/*.js`, que **estão no git**. Ou seja: após `git clone`, o portal roda direto,
  sem precisar das planilhas.
- Os `.xlsx` só são necessários para **regenerar** os `web/data/*.js` (nova carga de dados).
  Se for atualizar os dados em outra máquina, leve as planilhas à parte e rode os scripts.

> Regra do projeto: **nunca** commitar `.xlsx` nem editar `web/data/dados.js` à mão — ele é
> gerado. Ajustes de dado se fazem na planilha + regeneração.

---

## Identidade visual (PMF / SME)

A pele segue a identidade institucional da Prefeitura de Fortaleza / Secretaria da Educação
(fonte **Montserrat**, laranja **#F15A22**, verde **#009889**, azul **#00A0DC**, petróleo
**#325565**).

- **Guia da skill:** [`.claude/skills/identidade-pmf/SKILL.md`](.claude/skills/identidade-pmf/SKILL.md)
  — tokens oficiais, componentes (masthead, botões, status, rodapé) e regras de ouro.
- **Tokens em CSS:** `web/fortaleza-design-system.css` (variáveis `--fz-*`) e o bloco `:root`
  do `web/styles.css` (`--laranja`, `--verde`, `--azul`, `--fonte-ui`, `--cor-2025/2026`, etc.).
- **Referências:** `AUDITORIA.md` (extração do Portal da Educação), `DESIGN_SYSTEM.md`
  (manual resumido) e `ANTES_DEPOIS.md` (o que mudou em cada rodada).

> Ao mexer em qualquer parte visual, usar **sempre as variáveis** (nunca hex solto) e seguir
> a skill `identidade-pmf`. Brasão: usar só o vetor oficial — hoje há um placeholder
> tipográfico no rodapé até a Comunicação da SME enviar `web/assets/brasao-branco.svg`.

---

## Correções pendentes

- [ ] **Rosca de Salas cortando** (arco/desenho da rosca com corte visual).
- [ ] **Cobertura cumulativa** — a seção Cobertura do balão precisa acumular por período.
- [ ] **Nota das 952** — revisar/explicar a nota do previsto (fantasma da etapa 02).
- [ ] **Funil** — exibir a tag de categoria e melhorar o UX da sub-lista que abre ao clicar.
- [ ] **Panorama: 6 → 4 cards** — reduzir os KPIs de 6 para 4.
- [ ] **Buscar unidade sempre 512** — a busca/lista deve refletir sempre as 512 unidades.
- [ ] **Subestação consolidada** — visão consolidada com ícones novos.
- [ ] **Salas 2025** — acerto da contagem/atribuição das salas de 2025.

---

## Notas técnicas

- Sem dependências de build: editar `web/*` e recarregar o navegador.
- Mapa: **Leaflet 1.9.4** (CDN) + tiles **CARTO light**.
- Identidade do git deste repo: `Portal Climatizacao <portal@local>`.
