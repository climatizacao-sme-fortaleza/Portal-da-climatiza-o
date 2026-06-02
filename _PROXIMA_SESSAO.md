# Retomar daqui — próxima sessão

Estado salvo no commit **8f42cd4** (layout numa tela só + cartões no padrão KPI).
Tags de restauração: `faixa-navegacao-limpa`, `navegacao-completa`, `drill-4-niveis`,
`mapa-limpo-bordas`, `painel-4-blocos`.

## Tarefa a resolver primeiro (colar no Code ao voltar)

> O portal está exibindo o layout de celular (tudo empilhado numa coluna estreita)
> mesmo no computador com a janela maximizada. O ponto de quebra que decide quando
> usar o modo celular está alto demais e pegando telas de computador. Ajuste para que
> o layout lado a lado (painel à esquerda, mapa à direita, cartões embaixo) apareça em
> telas de computador normais, e o empilhamento só aconteça em telas realmente estreitas,
> de celular. Teste numa largura de computador comum e confirme que voltou ao lado a lado.
> Faça o commit ao terminar.

## Pistas técnicas (pra resolver rápido)

- O breakpoint do modo celular está em **`@media(max-width:760px)`** no `web/styles.css`
  (regra que faz `.mapwrap{flex-direction:column}`, destrava o `.tela`, e os cartões
  viram 1 coluna). Há também `@media(max-width:960px)` (cartões em 2 colunas) e
  `@media(max-width:560px)` (cartões em 1 coluna) na `.cardstrip`.
- Hipótese provável: a tela do usuário, **mesmo maximizada, tem largura CSS ≤ 760px**
  por causa do **escalonamento de tela do Windows** (ex.: 150–200% de zoom de exibição),
  então o `max-width:760px` dispara o modo celular num desktop. Confirmar pedindo
  `window.innerWidth` na máquina dele.
- Correção: **baixar o breakpoint do modo celular** (ex.: para ~620–680px, largura real
  de celular) para o lado a lado voltar nos desktops; manter o empilhamento só em telas
  estreitas de verdade. Revisar junto os breakpoints da `.cardstrip` (760/960/560) pra
  ficarem coerentes.
- Validar com `preview_eval` em largura de desktop comum (1280/1366) — deve mostrar
  painel à esquerda + mapa à direita + cartões embaixo (lado a lado, não empilhado).

## Aviso de ambiente

- **Disco C: quase cheio.** Numa gravação anterior o `styles.css` foi truncado a 0 bytes
  por falta de espaço (recuperado via git + reaplicado). Liberei até ~545 MB (lixeira +
  temp + caches). Se faltar espaço de novo, limpar antes de gravar/commitar.
- Validação do portal é por **preview_eval (inspeção do DOM)**, não por screenshot.
- Commits usam identidade por-comando:
  `git -c user.name="Portal Climatizacao" -c user.email="portal@local" commit ...`
  (NÃO alterar o git config).
