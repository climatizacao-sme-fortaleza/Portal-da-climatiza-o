# Portal de Gestão da Climatização Escolar — Fortaleza
## Documento de modelo e especificação para construção no Claude Code

Este documento descreve o que construir e em cima de qual estrutura de dados. A fonte de dados é a planilha `CLIMATIZACAO_MODELO_CONSOLIDADO.xlsx`, com três tabelas ligadas pelo código **SGE** (chave única de cada escola). O INEP não serve como chave porque vem quase todo vazio.

Recorte: 512 unidades (exclui CRP e CAEE).

---

## 1. Objetivo

Um portal único onde qualquer gestor enxerga, sem abrir planilha:
1. O mapa de Fortaleza com as 512 escolas, agrupáveis por regional, bairro e distrito.
2. A ficha completa de uma escola (cadastro, diagnóstico, ordens de serviço, execução).
3. O funil do programa: quantas escolas em cada estágio, do "a iniciar" ao "climatizada".
4. Os pontos travados, acesos automaticamente: O.S. parada na fila de assinatura, escola represada por falta de subestação, diagnóstico parado no repasse entre engenheiros.

O valor central do portal é tornar visível o que hoje fica na cabeça das pessoas. Os três gargalos que ele precisa expor são: o repasse do Ed para o Luccas, a fila de assinatura das O.S. e a represa de subestação.

---

## 2. As três tabelas (esquema)

### Tabela ESCOLA (identidade fixa, 512 linhas, já preenchida)
| Campo | Tipo | Observação |
|---|---|---|
| SGE | texto | chave única |
| TIPO | texto | EMTP, CEI, EMTI, ANE |
| UNIDADE ESCOLAR | texto | nome |
| DISTRITO | texto | distrito de educação |
| REGIONAL | número | regional administrativa (I a XII, Centro) |
| BAIRRO | texto | |
| COD_BAIRRO | número | |
| TERRITÓRIO | número | |
| ETAPA | texto | ETAPA 01 / ETAPA 02 |
| Nº DE SALAS | número | |
| POSSUI SUBESTAÇÃO? | lista | SIM / NÃO |
| POTÊNCIA SUBESTAÇÃO | texto | |
| STATUS GERAL | lista fechada | a régua macro, ver seção 3 |
| VALOR ADEQ. CIVIL | moeda | pode estar vazio |
| VALOR ADEQ. ELÉTRICA | moeda | pode estar vazio |
| VALOR TOTAL ADEQ. | moeda | pode estar vazio |
| TEM DADOS DE EXECUÇÃO (2025/26) | lista | SIM / NÃO |

### Tabela DIAGNOSTICO (o estudo do Ed, uma linha por escola)
SGE e nome já vêm preenchidos. A régua de repasse começa vazia e passa a ser alimentada.
| Campo | Tipo | Observação |
|---|---|---|
| SGE | texto | chave, liga com ESCOLA |
| UNIDADE ESCOLAR | texto | |
| SALAS CLIMATIZÁVEIS | número | as que o Ed validou com a diretora |
| SALAS FORA | número | |
| NECESSITA SUBESTAÇÃO | lista | SIM / NÃO |
| ESTÁGIO DO REPASSE | lista fechada | ver seção 3 |
| DATA VISITA | data | |
| DATA ESTUDO (ED) | data | |
| DATA REPASSE (LUCCAS) | data | |
| DATA O.S. ELÉTRICA | data | |
| RESPONSÁVEL DIAGNÓSTICO | texto | ED |
| OBSERVAÇÃO | texto | |

### Tabela OS (ordens de serviço, várias por escola)
Template vazio. Começa a encher agora. Cada escola pode ter mais de uma O.S. (uma civil, uma elétrica), e elas evoluem de forma independente até a assinatura.
| Campo | Tipo | Observação |
|---|---|---|
| Nº O.S. | texto | gerado na criação, independente da assinatura |
| SGE | texto | chave, liga com ESCOLA |
| UNIDADE ESCOLAR | texto | |
| TIPO | lista | CIVIL / ELÉTRICA |
| RESPONSÁVEL | lista | ROQUE (civil) / LUCCAS (elétrica) |
| VALOR | moeda | |
| PRIORIDADE | lista | NORMAL / ALTA / URGENTE (define a ordem que sobe pra assinatura) |
| ESTÁGIO | lista fechada | ver seção 3 |
| DATA ÚLTIMO MOVIMENTO | data | |
| DIAS NESTE ESTÁGIO | número | calculado: hoje menos a data do último movimento |
| LINK ORÇAMENTO | texto/url | |
| OBSERVAÇÃO | texto | |

Execução (máquinas por BTU, valores de serviço, datas de instalação) fica nas abas 2025 e 2026 da planilha original, amarrada pelo mesmo SGE. O portal lê de lá para a parte de execução.

---

## 3. As réguas de status (listas fechadas, não digitar livre)

**STATUS GERAL (ESCOLA)** — já existe na base, preenchido:
`0. A INICIAR` → `1. VISTORIA` → `2. ANALISE ELETRICA E CIVIL` → `3. ORÇAMENTO E PLANTA` → `4. APROVAÇÃO A.S.` → `5. EXECUÇÃO DAS ADEQUAÇÕES` → `6. ENTREGA DE MÁQUINAS` → `9. CLIMATIZADA` / `10. CLIMATIZADA PARCIAL`

**ESTÁGIO DO REPASSE (DIAGNOSTICO)** — o fluxo interno Ed/Luccas:
`1. VISITADO` → `2. ESTUDO ELÉTRICO CONCLUÍDO (ED)` → `3. REPASSADO AO LUCCAS` → `4. O.S. ELÉTRICA GERADA`
Travou entre 2 e 3: cobra o Ed. Travou entre 3 e 4: cobra o Luccas.

**ESTÁGIO (OS)** — a fila de assinatura:
`1. GERADA` → `2. AGUARDANDO GIZELLY` → `3. ENVIADA AO SECRETÁRIO` → `4. ASSINADA` → `5. EM EXECUÇÃO` → `6. CONCLUÍDA`
Acende vermelho quando os dias no estágio passam do limite (sugestão: 15 dias).

---

## 4. O que o portal deve renderizar

Peça ao Code em camadas, nesta ordem. Uma camada de cada vez.

**Camada 1 — Mapa.** Mapa de Fortaleza com as 512 escolas. Filtro por regional, bairro e distrito. Cor do ponto pelo STATUS GERAL (a iniciar, em andamento, climatizada). Nota: a planilha tem endereço e bairro, mas não tem latitude e longitude. O Code precisa geocodificar os endereços (ou, no mínimo, posicionar por centroide de bairro). Tratar isso como primeira tarefa técnica do mapa.

**Camada 2 — Ficha da escola.** Ao clicar numa escola: dados de cadastro, status geral, diagnóstico (salas climatizáveis, subestação, estágio do repasse), as O.S. dela com o estágio de cada uma, e a execução (máquinas, valores) vinda das abas 2025/2026.

**Camada 3 — Funil.** Quantas das 512 em cada estágio. Quantas diagnosticadas, quantas com O.S. gerada, quantas assinadas, quantas em obra, quantas climatizadas. E o número da represa: quantas escolas estão prontas mas travadas por falta de subestação.

**Camada 4 — Alertas.** Listas automáticas: O.S. paradas há mais de 15 dias por estágio; diagnósticos parados no repasse; escolas represadas por subestação. Cada alerta é uma lista clicável que leva à escola.

---

## 5. Notas de construção

- A chave de tudo é o SGE. Toda junção entre tabelas é por SGE.
- Os status são listas fechadas de propósito. O portal pode confiar nos valores exatos das réguas para montar o funil e os alertas. Não aceitar status livre.
- Histórico de O.S. e de repasse não existe no passado. Essas tabelas começam vazias e enchem a partir de agora. O funil de O.S. nasce em zero; o funil macro (STATUS GERAL) já nasce com número real.
- Fase 1: o portal lê o arquivo `CLIMATIZACAO_MODELO_CONSOLIDADO.xlsx` (estático). É assim que se constrói e itera.
- Fase 2 (depois do portal de pé): trocar o arquivo estático pela leitura ao vivo do Google Sheets, para que Luana e a pessoa responsável continuem trabalhando na planilha de sempre e o portal atualize sozinho. A leitura ao vivo usa a API do Google Sheets, autorizada pela conta que tem acesso de editor à base.

---

## 6. Stack sugerida (o Code pode ajustar)

- Frontend web com mapa interativo (por exemplo React com biblioteca de mapas).
- Leitura dos dados a partir do arquivo Excel na fase 1, e da API do Google Sheets na fase 2.
- Sem banco de dados próprio na fase 1: o Sheets é a fonte de verdade. Isso evita o problema que matou as tentativas anteriores, que era manter uma base nova alimentada.
