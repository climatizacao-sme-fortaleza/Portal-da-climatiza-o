# Portal da Climatização — o que mudou desde a conversa sobre CSV

Briefing para retomar o assunto no Claude chat. Cobre tudo o que aconteceu depois da
mensagem em que eu corrigi que a planilha já está no Sheets e que a ideia de exportar
como CSV não tinha me agradado.

---

## 1. Duas correções de premissa

**O portal não é React.** É HTML, CSS e JavaScript puro, sem framework e sem build.
São ~1.500 linhas em `web/app.js` que rodam direto no navegador. Não existe projeto a
migrar, e a troca de fonte de dados não exigiu reescrever nada.

**Não fomos de CSV publicado.** A ideia foi descartada e o motivo é bom: publicar a
planilha como CSV a tornaria **pública para quem tivesse o link**. Em vez disso o portal
lê pela **API do Google Sheets com uma conta de serviço**, e a planilha continua privada,
compartilhada apenas com um e-mail de robô, como Leitor. Meu desconforto com o CSV estava
certo e virou requisito.

---

## 2. Como a planilha mestra realmente é

Cinco abas. A que importa é `BASE MESTRA (512)`: **uma linha por unidade, 64 colunas**,
3.203 linhas no total e ~105 mil fórmulas.

- **677 linhas têm SGE**, mas só **512 têm STATUS GERAL** — as outras 165 são CRP (156) e
  CAEE (9), que estão fora do escopo. A regra de corte é essa.
- Os 512 batem **exatamente** com os que o portal já tinha. Nenhum sobrando, nenhum faltando.
- A aba oculta `_LISTAS` guarda as réguas fechadas (status, grupo, período, categoria,
  estágio, equipe). Elas existem de verdade e são usadas na validação.

O portal antigo lia **quatro estruturas separadas** (escola, diagnóstico, O.S., execução).
A mestra virou **uma tabela plana**. Os formatos não se encaixavam mais, e foi isso que
exigiu um transformador novo.

---

## 3. O que a auditoria encontrou

**O portal estava desatualizado em 88 das 512 unidades** — 17%. O funil no ar dizia
316/27/17/152 quando a planilha já dizia 312/26/16/158.

**O número de salas estava errado.** O portal usava 5.518 (o antigo "Nº de salas"). O
número oficial da mestra é **8.011**, que é a soma de administrativas (1.757) e pedagógicas
(6.254) e fecha em 503 de 503 linhas.

**As salas climatizadas eram deduzidas, não medidas.** O portal somava todas as salas de
uma escola marcada como climatizada e ainda somava +1 pela sala dos professores — que já
estava contada dentro do total, causando **contagem dupla em 218 unidades**. A mestra tem
o número medido unidade por unidade: **3.378**.

**O investimento estava com R$ 5,3 milhões a menos.** O bloco de execução do portal era
antigo (R$ 9,21 mi); a mestra tem **R$ 14,52 mi**.

**O orçamento das A.S. nunca foi desenhado.** Os campos existiam no dado e não apareciam
em tela nenhuma.

### Erros de dado que a validação pegou

- **SGE 426** — 12 salas climatizadas para 6 salas no total.
- **7 unidades sem número de salas** (SGE 215, 403, 432, 447, 791, 819, 943).
- **3 serviços com valor medido acima do autorizado na A.S.**, sendo o SGE 164 o mais
  grave (autorizado R$ 19.936,30, medido R$ 71.921,46).
- **82 células com texto onde deveria haver valor** (`SEINF`, `PENDENTE ELÉTRICA`,
  `PRONTA`, e até nomes de pessoas) nas colunas de orçamento.
- **81 unidades com medição registrada e nenhum orçamento** — R$ 5,66 milhões sobre os
  quais a regra "medido ≤ autorizado" não pode nem ser aplicada.

Ponto positivo: `TOTAL GASTO = máquinas + civil + elétrica + instalação` **fecha em 189 de
189** unidades. A aritmética da planilha está correta.

---

## 4. Regras que a gestão definiu e viraram código

**Estudo elétrico:** unidade em status 2 ou acima já foi visitada, logo tem estudo. O que
falta nesses casos é só a data da visita. Derivado, não digitado.

**Categoria de subestação (mapa):** a necessidade pesa **antes** de "climatizada" — escola
já climatizada que ainda precisa de subestação continua aparecendo como `nova`/`aumento`.
A regra foi conferida contra os 512 registros anteriores e acerta **511 de 512**.

**Sala dos professores:** já está contada dentro das salas climatizadas, como uma das
administrativas. Virou apenas uma **tag** na ficha, e parou de somar em qualquer contagem.

**Valores:** não existe aditivo. O medido é sempre igual ou menor que o autorizado na
A.S., **exceto** quando há duas A.S. para o mesmo serviço — caso da escola feita parcial
numa etapa e concluída na seguinte.

**Unidade feita em duas etapas** fica registrada na etapa 01, para não contar em dois anos.

---

## 5. O que foi construído

**`tools/importa_mestra.py`** — lê a mestra (do `.xlsx` baixado ou da API ao vivo, mesmo
código), aplica a tipagem, e **não grava nada se o portão de validação reprovar**. O portão
checa: 512 unidades no escopo, SGE único, nenhuma unidade sumindo, nenhuma unidade nova
sem conferência humana, status dentro da régua, todas com coordenada dentro de Fortaleza.
Fora isso ele **avisa sem reprovar** sobre os erros de dado listados acima.

**`.github/workflows/atualiza-dados.yml`** — o robô. De hora em hora em dia útil, mais
botão de execução manual. Só commita e publica se o dado mudou **e** passou na validação.
Se a planilha estiver com problema, o job falha, chega e-mail, e o site continua servindo
o último dado bom.

**No portal:**
- Os totais do parque deixaram de ser números fixos no código e passaram a ser derivados
  da base — o número de salas muda a cada vistoria.
- A ficha ganhou o bloco **Salas** (total, quebra administrativa/pedagógica, climatizadas
  com percentual, sala dos professores como tag) e o bloco **Orçamento · A.S.**
- A faixa de indicadores foi de 4 para **5 cards**, atravessando a largura inteira abaixo
  do painel e do mapa. O vazio abaixo da linha do tempo caiu de 376px para zero e o bloco
  ficou 93px mais baixo com 290px a mais de largura útil.
- Carimbo no rodapé com a data da carga e a origem do dado.

---

## 6. Estado atual

O robô **já rodou com sucesso**: leu a planilha ao vivo, validou, commitou sozinho e
publicou. Site no ar com funil 312/26/16/158, 8.011 salas, 3.378 climatizadas e
R$ 14.522.476,89.

A primeira carga revelou um defeito que só apareceu porque ela rodou: o `.xlsx` entrega
`49363.4` e a API entrega `49363.399999999994`. Mesmo valor, representação diferente. Sem
arredondar na origem, o robô geraria commit de barulho a cada recálculo da planilha.
Corrigido, com conferência campo a campo: 51 campos mudam, todos só de representação,
nenhuma diferença real.

---

## 7. O que ainda falta

**Na planilha mestra:**

- **Quebra por etapa dos valores de execução.** Hoje é uma linha por unidade com os
  valores somados, então a ficha não consegue detalhar etapa 01, etapa 02 e total — que é
  o que a gestão pediu. Precisa de colunas separadas ou uma aba de execução com uma linha
  por etapa. **É o único item que bloqueia um pedido em aberto.**
- Valor autorizado preenchido nas 81 unidades que têm medição sem A.S.
- Separar valor de situação nas colunas de orçamento (as 82 células com texto).
- Colunas que existem e estão vazias: `DATA DIAGNÓSTICO/VISITA`, `STATUS A.S. CIVIL` e
  `ELÉTRICA`, `O.S. (Nº)`, `TEM EXECUÇÃO`.
- Quebra administrativa/pedagógica das climatizadas: 58 unidades só têm o total.
- As correções pontuais: SGE 426 e as 7 unidades sem salas.

**No portal**, herdado de antes: rosca de salas cortando, cobertura cumulativa, nota das
952, tag de categoria no funil, busca sempre 512, subestação consolidada, salas 2025.
Todos precisam de decisão da gestão antes de virarem tarefa.

---

## 8. Uma questão de desenho em aberto

O carimbo do rodapé responde **"de quando é este dado"**, não "quando o robô olhou pela
última vez". Se a planilha não mudou, o robô roda, confere, não acha diferença, não
commita — e o carimbo continua com a data antiga, mesmo com tudo funcionando.

Isso confunde: dá impressão de robô parado quando ele está saudável. A alternativa é
carimbar toda execução bem-sucedida, o que dá um sinal de vida visível ao custo de um
commit por hora no histórico. **Ainda não decidido.**
