# Robô de atualização automática

O portal lê os arquivos em `web/data/`. Esses arquivos são **gerados** pelo
`tools/importa_mestra.py` a partir da BASE MESTRA. O robô é só isso rodando
sozinho: o workflow `.github/workflows/atualiza-dados.yml` lê a planilha de hora
em hora, valida, e publica **apenas se passar na validação**.

Se a planilha estiver com problema, o robô falha e manda e-mail — e o site
continua no ar com o último dado bom. Nunca publica dado reprovado.

---

## O que falta para ligar

Uma configuração única, sua, de uns 5 minutos. **Não me mande a chave** — ela vai
direto do Google para o GitHub, sem passar por mim nem pela conversa.

### 1. Criar a conta de serviço no Google

1. Abra <https://console.cloud.google.com> e crie um projeto (ou use um existente).
   Nome sugerido: `portal-climatizacao`.
2. Menu **APIs e serviços → Biblioteca**. Busque **Google Sheets API** e clique em
   **Ativar**.
3. Menu **APIs e serviços → Credenciais → Criar credenciais → Conta de serviço**.
   - Nome: `robo-portal-climatizacao`
   - Pode pular as etapas de permissão (ela não precisa de papel nenhum no projeto).
4. Abra a conta de serviço criada, aba **Chaves → Adicionar chave → Criar nova
   chave → JSON**. O arquivo baixa sozinho. **Esse arquivo é a senha do robô.**
5. Na mesma tela, copie o **e-mail da conta de serviço**. Tem esta cara:
   `robo-portal-climatizacao@portal-climatizacao.iam.gserviceaccount.com`

### 2. Dar acesso de leitura à planilha

Abra a planilha mestra, botão **Compartilhar**, cole o e-mail da conta de serviço,
escolha **Leitor** e desmarque *Notificar pessoas*.

Leitor basta. O robô nunca escreve na planilha.

### 3. Guardar a chave no GitHub e disparar a primeira carga

Tem um script que faz o resto: confere a chave, mostra o e-mail da conta de serviço,
guarda a chave no GitHub, apaga o arquivo local e dispara a primeira carga.
**A chave não aparece na tela em momento nenhum** — vai do arquivo direto para o GitHub.

Primeiro o login (uma vez só, escolha *Login with a web browser*):

```powershell
& "$env:LOCALAPPDATA\portal-cli\bin\gh.exe" auth login
```

Depois:

```powershell
powershell -ExecutionPolicy Bypass -File tools\liga-robo.ps1 -Chave "C:\caminho\da\chave.json"
```

Ele para com mensagem clara se a chave estiver errada, se faltar login, ou se não
conseguir gravar o segredo. Para conferir sem apagar o arquivo, use `-ManterArquivo`.

**Prefere fazer na mão?** É **Settings → Secrets and variables → Actions → New repository
secret**, nome `GOOGLE_SHEETS_CREDENCIAL`, e o conteúdo inteiro do JSON no campo do valor.
Depois apague o arquivo do computador.

### 4. Conferir

Aba **Actions** do repositório → **Atualiza dados da planilha mestra**. Em uns 2 minutos
ele diz se deu certo. O rodapé do portal passa a mostrar *"planilha ao vivo"*.

---

## Como o robô se comporta

| Situação | O que acontece |
|---|---|
| Planilha mudou e passou na validação | Commita em `main`, publica no site, rodapé mostra a hora |
| Planilha não mudou | Não faz nada, não gera commit |
| Validação reprovou | **Job falha**, você recebe e-mail, o site fica como está |
| Credencial errada ou sem acesso | Job falha com a mensagem dizendo exatamente o quê |

Horário: de hora em hora, das 7h às 19h de Fortaleza, de segunda a sexta. Para
mudar, é a linha `cron` no workflow (o horário lá é UTC, Fortaleza é UTC−3).

Para atualizar fora de hora, use o **Run workflow**.

---

## O que a validação checa

O portão está em `validar()` no `tools/importa_mestra.py`. Reprova a carga se:

- não vierem exatamente 512 unidades no escopo;
- houver SGE repetido, ou faltar SGE;
- sumir alguma unidade que já existia no portal;
- aparecer unidade nova (precisa de conferência humana antes de entrar);
- algum status estiver fora da régua fechada;
- alguma unidade estiver sem coordenada, ou com coordenada fora de Fortaleza;
- faltar nome, bairro, distrito ou tipo em alguma unidade.

Além disso ele **avisa sem reprovar** (aparece no log do job): texto em coluna de
valor, salas climatizadas maiores que o total da unidade, medição acima do
autorizado na A.S., e unidades com medição e sem orçamento registrado.

---

## Rodar na mão, sem o robô

Continua funcionando, com a planilha baixada:

```bash
python tools/importa_mestra.py "CAMINHO/PLANILHA.xlsx" web/data           # ensaio
python tools/importa_mestra.py "CAMINHO/PLANILHA.xlsx" web/data --gravar  # grava
```

Ou já com a credencial configurada localmente, direto da planilha ao vivo:

```bash
python tools/importa_mestra.py --sheet <ID_DA_PLANILHA> web/data --gravar
```
