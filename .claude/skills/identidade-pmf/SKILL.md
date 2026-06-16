---
name: identidade-pmf
description: >
  Use SEMPRE que for criar, alterar ou ajustar qualquer parte visual do portal
  de climatizacao (cores, fontes, botoes, cards, cabecalho, rodape, espacamento,
  layout, status, mapa). Garante aderencia a identidade institucional da
  Prefeitura de Fortaleza / SME. Acione mesmo em ajustes pequenos de CSS.
---

# Identidade Visual PMF / SME — Portal de Climatizacao

Fonte de verdade: Manual de Identidade Visual PMF 2025-2028 + padroes do
Portal da Educacao (WordPress/Blocksy, Montserrat, laranja #F15A22).

## Tokens oficiais (use SEMPRE as variaveis, nunca hex solto)
- Laranja  `#F15A22`  prioritaria: CTA, faixa masthead, links de acao, rodape
- Verde    `#009889`  secundaria: realce, status climatizada, navegacao ativa
- Azul     `#00A0DC`  detalhe: so acentos pontuais, nunca area grande
- Creme    `#FFE6CB`  fundo de secao de destaque, nunca o fundo geral
- Petroleo `#325565`  titulos e numeros grandes
- Grafite  `#414042`  corpo de texto
- Fundo geral: branco `#FFFFFF`

## Tipografia
- Fonte unica na web: **Montserrat** (400/500/600/700/800). Google Fonts.
- Titulos e masthead: peso 700-800. Sem serifa. Sem italico decorativo.
- Micro-rotulos de secao: caixa alta, letter-spacing leve, peso 700.

## Componentes (padrao Educacao)
- Botao primario: fundo laranja, texto branco, sem borda, raio 3px, padding 5px 20px.
- Toggle/pill ativo: fundo petroleo, texto branco.
- Card de numero: fundo branco, borda fina, numero grande em petroleo.
- Masthead: faixa laranja solida, titulo branco. So o titulo, sem paragrafos longos.
- Rodape: faixa laranja, brasao + linha institucional curta. Sem endereco inventado.
- Status: climatizada=verde, parcial=#6FB97C, execucao=laranja, a iniciar=cinza.

## Hierarquia / titulos de secao
Titulos de bloco ("Mapa do Parque Escolar", "Panorama do Parque", etc.) devem
ter PESO. Nao deixar cinza apagado. Padrao: caixa alta, peso 700, cor petroleo,
com um marcador de acento (barra laranja a esquerda OU filete laranja embaixo).

## Regras de ouro (nunca quebrar)
1. Nunca renomear classe ou id existente. O app.js depende deles.
2. Nunca alterar logica, dados, filtros ou o mapa Leaflet. So aparencia.
3. Mexeu em estilo? Mostre o diff antes de salvar e va um arquivo por vez.
4. Minimalismo institucional: menos blocos decorativos, mais respiro. Releitura
   limpa do padrao da Prefeitura, nao copia literal do site de noticia.
5. Brasao: usar so o arquivo oficial (SVG/PNG). Nunca recriar o escudo a mao.

## Proporcao das cores
Laranja domina, verde e secundario, azul so em detalhe, creme so em fundo de
secao. Petroleo e grafite no texto. Se um ajuste deixar azul ou creme em area
grande, esta errado.
