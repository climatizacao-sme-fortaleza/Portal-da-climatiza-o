# DESIGN SYSTEM SME / PMF - Portal de Climatizacao

Referencia para aplicar a identidade institucional da Prefeitura de Fortaleza
no portal de climatizacao, espelhando o Portal da Educacao.

Fonte de verdade:
1. Manual de Identidade Visual PMF 2025-2028 (tokens de marca: cores e fontes).
2. Portal da Educacao (padroes de componente: masthead, nav, botoes, rodape).

Objetivo: aplicar os MESMOS tokens no layout atual do portal. Nao copiar a
estrutura de site de noticia. Manter o dashboard, trocar a pele.

---

## 1. Cores oficiais (hex exato do manual, pag. 21-22)

| Papel                      | Hex      | RGB           | Variavel CSS      |
|----------------------------|----------|---------------|-------------------|
| Prioritaria (laranja)      | #F15A22  | 241,90,34     | --fz-laranja      |
| Secundaria (verde/teal)    | #009889  | 0,152,137     | --fz-verde        |
| Detalhe (azul)             | #00A0DC  | 0,160,220     | --fz-azul         |
| Fundo prioritario (creme)  | #FFE6CB  | 255,230,203   | --fz-creme        |
| Tipografia (petroleo)      | #325565  | 50,85,101     | --fz-petroleo     |
| Tipografia (grafite)       | #414042  | 65,64,66      | --fz-grafite      |

Regra de uso (proporcao do manual): laranja domina, verde e secundario,
azul so em detalhe, creme so em fundo de secao. Petroleo e grafite para texto.

## 2. Tipografia

| Uso no manual            | Fonte (oficial)        | Situacao na web        |
|--------------------------|------------------------|------------------------|
| Titulo da marca FORTALEZA| Fox Grotesque Pro      | licenciada, nao usar web |
| Nome de secretarias      | Rawline Extra Bold     | disponivel como webfont |
| Sinalizacao / papelaria  | Aribau Grotesk         | licenciada, nao usar web |
| Rodape / apresentacao    | Arial                  | web-safe               |

Para a web usamos substitutos (ver stacks no CSS). A FONTE REAL do Portal da
Educacao deve ser confirmada pela extracao (prompt 1) e, se for diferente,
basta trocar o primeiro nome de cada stack `--fz-ff-*`.

## 3. Componentes (padrao Portal da Educacao)

- **Barra de utilidade** (topo): fundo cinza claro, links caixa alta em verde.
- **Masthead**: faixa laranja solida, titulo grande branco, blocos decorativos
  azul/verde/creme no canto direito.
- **Regua tricolor**: laranja, azul, verde (voce ja usa; padronizar nas cores oficiais).
- **Nav primaria**: fundo branco, links caixa alta petroleo, borda laranja embaixo,
  hover laranja.
- **Botao primario**: laranja solido, texto branco, caixa alta, raio 3px ("Leia mais").
- **Botao outline**: contorno verde, hover preenche verde.
- **Pills/toggles**: borda cinza, ativo = petroleo solido.
- **Cards de numero**: fundo branco, borda fina, numero grande em petroleo,
  borda-esquerda colorida opcional por categoria.
- **Painel destacado**: estilo "Servicos"/"Transparencia", fundo verde, raio 12px.
- **Status pills**: climatizada=verde, parcial=verde claro, execucao=laranja, a iniciar=cinza.
- **Rodape**: faixa laranja, redes em circulo de contorno branco, brasao a direita.

## 4. O que mudar no portal atual (climatizacao)

Estado atual: visual editorial (serifa de display, fundo creme texturizado).
Alvo: institucional Educacao.

1. Fundo principal: trocar creme por branco. Creme so em secoes de destaque.
2. Display: trocar a serifa por `--fz-ff-display` (grotesca institucional).
   Manter "Climatizacao Escolar Fortaleza" como titulo, dentro da faixa masthead laranja.
3. Adicionar: barra de utilidade no topo, faixa masthead, nav, rodape laranja,
   e o brasao (lockup horizontal) na barra/rodape.
4. Recolorir numeros e titulos para petroleo; acentos seguindo os papeis das cores.
5. Botoes: laranja solido caixa alta.
6. Status da tabela: alinhar as cores aos tokens de status.
7. Regua tricolor: usar laranja/azul/verde oficiais.

## 5. Brasao

Usar o lockup horizontal "FORTALEZA PREFEITURA" + tag da secretaria (EDUCACAO / SME).
Margem de seguranca: 3x a largura do "o" da palavra Prefeitura ao redor da marca.
Versao positiva em fundo claro; versao branca (flat) sobre a faixa laranja.
Pedir o arquivo vetorial (SVG/PNG) oficial a comunicacao da SME.
