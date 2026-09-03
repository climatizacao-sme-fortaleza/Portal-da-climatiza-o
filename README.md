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

A fonte primária é a **planilha mestra no Google Sheets** (base da SME/COINF), aba
`BASE MESTRA (512)`. Ela não está no repositório.

- O fluxo é: **planilha mestra** → `tools/importa_mestra.py` → **`web/data/*.js`** (versionados).
- **O portal NÃO depende da planilha em runtime.** Em produção/navegador ele lê apenas os
  `web/data/*.js`, que **estão no git**. Ou seja: após `git clone`, o portal roda direto.
- O importador aceita as duas fontes — a planilha ao vivo (pela API do Sheets) ou um
  `.xlsx` baixado — e **não grava nada se o portão de validação reprovar**:

```bash
python tools/importa_mestra.py "CAMINHO/PLANILHA.xlsx" web/data           # ensaio
python tools/importa_mestra.py "CAMINHO/PLANILHA.xlsx" web/data --gravar  # grava
python tools/importa_mestra.py --sheet <ID> web/data --gravar             # ao vivo
```

- O robô em `.github/workflows/atualiza-dados.yml` faz isso sozinho de hora em hora.
  Configuração e regras em **[`tools/ROBO.md`](tools/ROBO.md)**.
- Os scripts antigos em PowerShell (`build.ps1`, `xlsx2csv.ps1`, `geocode.ps1`,
  `writeback.ps1`) são do fluxo anterior, baseado em `.xlsx` local com caminhos fixos.
  Ficam por referência histórica; quem gera os dados hoje é o `tools/importa_mestra.py`.

> Regra do projeto: **nunca** editar `web/data/*.js` à mão — eles são gerados. Ajustes de
> dado se fazem na planilha mestra + regeneração.

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

### No portal

- [ ] **Rosca de Salas cortando** (arco/desenho da rosca com corte visual).
- [ ] **Cobertura cumulativa** — a seção Cobertura do balão precisa acumular por período.
- [ ] **Nota das 952** — revisar/explicar a nota do previsto (fantasma da etapa 02).
- [ ] **Funil** — exibir a tag de categoria e melhorar o UX da sub-lista que abre ao clicar.
- [ ] **Buscar unidade sempre 512** — a busca/lista deve refletir sempre as 512 unidades.
- [ ] **Subestação consolidada** — visão consolidada com ícones novos.
- [ ] **Salas 2025** — acerto da contagem/atribuição das salas de 2025.
- [ ] **Gasto por etapa na ficha** — mostrar etapa 01, etapa 02 e total por unidade.
      Bloqueado: a mestra tem uma linha por unidade com os valores já somados.

### Na planilha mestra

- [ ] **Quebra por etapa dos valores de execução** — destrava o item acima.
- [ ] **Valor autorizado onde há medição** — 81 unidades, R$ 5,66 mi sem A.S. registrada.
- [ ] **Separar valor de situação** nas colunas de orçamento — 82 células com texto
      (`SEINF`, `PENDENTE ELÉTRICA`, `PRONTA`) onde deveria haver número.
- [ ] **Colunas vazias que o portal já usaria**: `DATA DIAGNÓSTICO/VISITA`,
      `STATUS A.S. CIVIL/ELÉTRICA`, `O.S. (Nº)`, `TEM EXECUÇÃO`.
- [ ] **Quebra adm/pedagógica das climatizadas** — 58 unidades só têm o total.

> Concluído nesta rodada: carga da base mestra, salas medidas, execução regenerada,
> mapa de subestação recalculado, faixa de indicadores reorganizada em 5 cards, bloco
> de orçamento na ficha, carimbo de data no rodapé e o robô de atualização.
> O item "Panorama: 6 → 4 cards" saiu da lista: hoje são 5, por pedido da gestão.

---

## Notas técnicas

- Sem dependências de build: editar `web/*` e recarregar o navegador.
- Mapa: **Leaflet 1.9.4** (CDN) + tiles **CARTO light**.
- Identidade do git deste repo: `Portal Climatizacao <portal@local>`.
