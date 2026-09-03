# -*- coding: utf-8 -*-
"""
Importa a BASE MESTRA da planilha de climatizacao para web/data/dados.js.

Ensaio local: le o .xlsx baixado. Na versao final o mesmo transformador le a
planilha viva pela API do Google Sheets — so a funcao ler_mestra() muda.

Regras deliberadas:
  - Escopo   : linha com SGE preenchido E STATUS GERAL preenchido (exclui CRP/CAEE).
  - Chave    : SGE sempre string, sem o ".0" que vem de celula numerica.
  - Tipagem  : valores em moeda viram numero ou None; texto em coluna de moeda
               NAO vira zero, vira None (e e reportado).
  - Preserva : campos que a mestra ainda nao cobre sao mantidos do arquivo atual,
               nunca zerados. Hoje: salas, temExecucao.
  - So a linha window.ESCOLAS e reescrita; DIAGNOSTICO/OS/EXECUCAO ficam intactos.

Nada e gravado se o portao de validacao reprovar.
"""
import io, json, re, sys, zipfile, collections
from xml.etree import ElementTree as ET

NS  = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
NSR = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'

ABA_MESTRA = 'BASE MESTRA (512)'

REGUA_STATUS = {
    "0. A INICIAR", "1. VISTORIA", "2. ANALISE ELETRICA E CIVIL",
    "3. ORÇAMENTO E PLANTA", "4. APROVAÇÃO A.S.", "5. EXECUÇÃO DAS ADEQUAÇÕES",
    "6. ENTREGA DE MÁQUINAS", "9. CLIMATIZADA", "10. CLIMATIZADA PARCIAL",
}

# limites generosos de Fortaleza, so para pegar coordenada trocada ou com virgula perdida
LAT_MIN, LAT_MAX = -4.05, -3.60
LNG_MIN, LNG_MAX = -38.75, -38.30

# coluna da BASE MESTRA -> campo do portal
COLS = {
    'sge': 1, 'tipo': 2, 'nome': 3, 'endereco': 4, 'bairro': 5, 'codBairro': 6,
    'distrito': 7, 'regional': 8, 'territorio': 9, 'lat': 11, 'lng': 12,
    'etapa': 13, 'status': 14, 'subestacao': 18, 'potenciaSub': 19,
    'valorCivil': 27, 'valorEletrica': 28, 'valorTotal': 29,
    'asCivil': 30, 'asEletrica': 31,
}
CAMPOS_TEXTO   = ['tipo','nome','endereco','bairro','codBairro','distrito','regional',
                  'territorio','etapa','subestacao','potenciaSub','status','asCivil','asEletrica']
CAMPOS_MOEDA   = ['valorCivil','valorEletrica','valorTotal']
CAMPOS_MANTIDOS = ['temExecucao']   # a mestra ainda nao cobre com seguranca

# colunas extras usadas pelos arquivos auxiliares
COL_SALAS        = 56   # SALAS TOTAL (CLIMATIZAVEIS) = adm + pedagogicas
COL_NECESSITA    = 20
COL_POT_FUTURA   = 21
COL_DATA_SEINF   = 22
COL_SALA_PROF    = 63   # SALA DOS PROFESSORES CLIMATIZADA?

# status a partir do qual a unidade ja foi visitada e tem estudo eletrico (regra da gestao)
STATUS_COM_ESTUDO = 2

ORDEM_SAIDA = ['sge','tipo','nome','endereco','bairro','codBairro','distrito','regional',
               'territorio','etapa','salas','salasAdm','salasPedag','salasClim',
               'salasAdmClim','salasPedagClim',
               'subestacao','potenciaSub','status',
               'valorCivil','valorEletrica','valorTotal','asCivil','asEletrica',
               'temExecucao','lat','lng','geoSrc']

COL_SALAS_ADM        = 57
COL_SALAS_PEDAG      = 58
COL_SALAS_CLIM       = 59   # SALAS CLIMATIZADAS TOTAL (medido, ja inclui a sala dos professores)
COL_SALAS_ADM_CLIM   = 60
COL_SALAS_PEDAG_CLIM = 61
COL_OBS_PROF         = 64


# ---------------------------------------------------------------- leitura xlsx
def ler_mestra(caminho, aba=ABA_MESTRA):
    z = zipfile.ZipFile(caminho)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall(NS+'si'):
            shared.append(''.join(t.text or '' for t in si.iter(NS+'t')))
    wb   = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    mapa = {r.get('Id'): r.get('Target') for r in rels}
    alvo = None
    for sh in wb.iter(NS+'sheet'):
        if sh.get('name') == aba:
            t = mapa[sh.get(NSR+'id')]
            alvo = t[1:] if t.startswith('/') else 'xl/'+t
    if not alvo:
        raise SystemExit("aba '%s' nao encontrada" % aba)

    def idx(ref):
        n = 0
        for c in re.match(r'[A-Z]+', ref).group(0):
            n = n*26 + (ord(c)-64)
        return n

    linhas = []
    for row in ET.fromstring(z.read(alvo)).iter(NS+'row'):
        cel = {}
        for c in row.findall(NS+'c'):
            ref = c.get('r')
            if not ref:
                continue
            v, isn = c.find(NS+'v'), c.find(NS+'is')
            val = ''
            if isn is not None:
                val = ''.join(t.text or '' for t in isn.iter(NS+'t'))
            elif v is not None:
                val = v.text or ''
                if c.get('t') == 's' and val != '':
                    val = shared[int(val)]
            cel[idx(ref)] = val
        linhas.append(cel)
    return linhas


# ------------------------------------------------------------------- tipagem
def txt(v):
    s = str(v if v is not None else '').strip()
    if s.endswith('.0') and s[:-2].isdigit():   # celula numerica virando texto
        s = s[:-2]
    return s or None

def num(v):
    s = str(v if v is not None else '').strip()
    if not s:
        return None
    s = s.replace('R$', '').replace(' ', '').replace('\xa0', '')
    if ',' in s and '.' in s:                    # 1.234,56 -> 1234.56
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s:                               # 1234,56  -> 1234.56
        s = s.replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return None

def inteiro_se_puder(f):
    return int(f) if f is not None and float(f).is_integer() else f

def espacos(v):
    """Colapsa quebras de linha e espacos repetidos (as celulas da mestra tem \n dentro)."""
    s = re.sub(r'\s+', ' ', str(v if v is not None else '')).strip()
    return s or None

def data_br(v):
    """Serial de planilha ou texto -> dd/mm/aaaa. Devolve '' quando vazio."""
    s = str(v if v is not None else '').strip()
    if not s:
        return ''
    if re.match(r'^\d{2}/\d{2}/\d{4}$', s):
        return s
    n = num(s)
    if n is None:
        return s
    import datetime
    return (datetime.date(1899, 12, 30) + datetime.timedelta(days=int(n))).strftime('%d/%m/%Y')

def data_iso(v):
    """Serial de planilha ou texto -> aaaa-mm-dd (formato que o app.js sabe ler)."""
    s = str(v if v is not None else '').strip()
    if not s or s == '-':
        return None
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', s)
    if m:
        return '%s-%s-%s' % (m.group(3), m.group(2), m.group(1))
    n = num(s)
    if n is None:
        return None
    import datetime
    return (datetime.date(1899, 12, 30) + datetime.timedelta(days=int(n))).strftime('%Y-%m-%d')

def nivel(status):
    """Numero da regua: '10. CLIMATIZADA PARCIAL' -> 10."""
    try:
        return int(str(status).split('.')[0])
    except ValueError:
        return -1


# ------------------------------------------------------- auditoria de valores
# Regra da gestao: nao existe aditivo. O valor MEDIDO de um servico e sempre igual
# ou menor que o autorizado na A.S./O.S. daquele servico — a obra pode encolher (um
# servico previsto que no local se mostrou desnecessario), nunca crescer.
# Excecao legitima: unidade com DUAS A.S. para o mesmo servico, quando foi feita
# parcial numa etapa e concluida na seguinte (ex.: etapa 01 + etapa 02). Como a
# mestra tem uma linha por unidade, os dois valores chegam somados e estouram a
# comparacao. Por isso isto e AVISO, nao erro: precisa de olho humano.
PARES_ORCADO_MEDIDO = [
    (27, 45, 'CIVIL'),
    (28, 46, 'ELÉTRICA'),
]
COL_VALOR_MAQ    = 44
COLS_MEDICAO     = (45, 46, 47)
COL_TOTAL_GASTO  = 48

def audita_valores(linhas):
    excedidos, sem_orcamento, nao_fecham = [], [], []
    for r in linhas[1:]:
        sge = txt(r.get(COLS['sge']))
        if not sge or not str(r.get(COLS['status'], '')).strip():
            continue
        nome = txt(r.get(COLS['nome'])) or ''
        for c_orc, c_med, rotulo in PARES_ORCADO_MEDIDO:
            orcado, medido = num(r.get(c_orc)), num(r.get(c_med))
            if orcado is None or not medido:
                continue
            if medido > orcado + 0.05:
                excedidos.append((sge, nome, rotulo, orcado, medido))
        medicao = sum(num(r.get(c)) or 0 for c in COLS_MEDICAO)
        if medicao > 0 and num(r.get(COLS['valorTotal'])) is None:
            sem_orcamento.append((sge, nome, medicao))
        total = num(r.get(COL_TOTAL_GASTO))
        if total is not None:
            partes = (num(r.get(COL_VALOR_MAQ)) or 0) + medicao
            if abs(total - partes) > 0.05:
                nao_fecham.append((sge, nome, total, partes))
    return excedidos, sem_orcamento, nao_fecham


# ------------------------------------------------- arquivos auxiliares por SGE
def calc_estudo(status):
    """Regra da gestao: do status 2 em diante a unidade ja foi visitada -> tem estudo."""
    return 'TEM' if nivel(status) >= STATUS_COM_ESTUDO else 'FALTA'

def calc_categoria(status, necessita, estudo):
    """Categoria do mapa de subestacao. A necessidade pesa ANTES de 'climatizada':
    escola ja climatizada que ainda precisa de subestacao continua aparecendo como
    nova/aumento. Regra conferida contra o mapa_sub.js anterior: 511/512."""
    if necessita == 'NOVA':
        return 'nova'
    if necessita == 'AUMENTO':
        return 'aumento'
    if nivel(status) in (9, 10):
        return 'climatizada'
    if estudo == 'FALTA':
        return 'falta_estudo'
    return 'liberada'

def linhas_auxiliares(linhas):
    """Monta subestacao / mapa_sub / salas_prof a partir da mesma leitura da mestra."""
    sub, mapa, prof = {}, {}, {}
    for r in linhas[1:]:
        sge = txt(r.get(COLS['sge']))
        status = str(r.get(COLS['status'], '')).strip()
        if not sge or not status:
            continue
        necessita = (espacos(r.get(COL_NECESSITA)) or 'NAO').upper()
        estudo = calc_estudo(status)
        sub[sge] = {
            'p':  espacos(r.get(COLS['subestacao'])) or '',
            'pa': espacos(r.get(COLS['potenciaSub'])) or '',
            'n':  necessita,
            'pf': espacos(r.get(COL_POT_FUTURA)) or '',
            'd':  data_br(r.get(COL_DATA_SEINF)),
            'e':  estudo,
        }
        mapa[sge] = calc_categoria(status, necessita, estudo)
        sp = espacos(r.get(COL_SALA_PROF))
        if sp:
            # s = situacao da sala dos professores (vira tag na ficha)
            # o = observacao, que e onde fica o motivo (PADRAO JURACI = precisa construir,
            #     NAO CLIMATIZADA = a unidade nao tem sala dos professores)
            prof[sge] = {'s': sp.upper(), 'o': espacos(r.get(COL_OBS_PROF)) or ''}
    return sub, mapa, prof


# colunas do bloco de execucao na mestra
COLS_EXEC = dict(etapa=13, ar12=38, ar18=39, ar24=40, ar36=41, ar48=42, totalMaq=43,
                 valorMaq=44, servCivil=45, servEletrica=46, servInstalacao=47,
                 totalGasto=48, statusCivil=50, statusEletrica=51, statusInstalacao=52,
                 equipe=53, inicio=54, fim=55)
ORDEM_EXEC = ['etapa','ar12','ar18','ar24','ar36','ar48','totalMaq','valorMaq',
              'servCivil','servEletrica','servInstalacao','totalGasto',
              'statusCivil','statusEletrica','statusInstalacao','equipe','inicio','fim']
EXEC_INT   = ['ar12','ar18','ar24','ar36','ar48','totalMaq']
EXEC_NUM   = ['valorMaq','servCivil','servEletrica','servInstalacao','totalGasto']

def gera_execucao(linhas):
    """EXECUCAO por SGE. A mestra tem UMA linha por unidade, entao sai uma entrada por
    unidade — mesmo quando a obra foi feita em duas etapas, caso em que os valores ja
    vem somados e a etapa registrada e a primeira (decisao da gestao, para a unidade
    nao contar em dois anos). Ver o relatorio: a quebra por etapa nao existe na fonte."""
    exec_, sem_etapa = {}, []
    for r in linhas[1:]:
        sge = txt(r.get(COLS['sge']))
        if not sge or not str(r.get(COLS['status'], '')).strip():
            continue
        e = {}
        for campo in EXEC_INT:
            e[campo] = inteiro_se_puder(num(r.get(COLS_EXEC[campo])))
        for campo in EXEC_NUM:
            e[campo] = inteiro_se_puder(num(r.get(COLS_EXEC[campo])))
        for campo in ('etapa', 'statusCivil', 'statusEletrica', 'statusInstalacao', 'equipe'):
            e[campo] = espacos(r.get(COLS_EXEC[campo]))
        e['inicio'] = data_iso(r.get(COLS_EXEC['inicio']))
        e['fim']    = data_iso(r.get(COLS_EXEC['fim']))
        # so vira entrada de execucao se houver algo executado de fato
        tem = (e['totalGasto'] is not None or e['totalMaq'] or e['valorMaq'] is not None
               or e['statusInstalacao'] or e['equipe'])
        if not tem:
            continue
        if not e['etapa']:
            sem_etapa.append(sge)
        exec_[sge] = [{k: e.get(k) for k in ORDEM_EXEC}]
    return exec_, sem_etapa


def escreve_subestacao(caminho, sub):
    cab = ("// Subestacao / estudo eletrico por SGE. Gerado da BASE MESTRA - NAO editar a mao.\n"
           "//   p  = POSSUI_SUBESTACAO:    \"SIM\" | \"NÃO\"\n"
           "//   pa = POTENCIA_ATUAL:       ex \"75 KVA\" | \"\" (so quando possui)\n"
           "//   n  = NECESSITA_SUBESTACAO: \"NOVA\" | \"AUMENTO\" | \"NAO\"\n"
           "//   pf = POTENCIA_FUTURA:      ex \"112,5 KVA\" | \"\" (so quando necessita)\n"
           "//   d  = DATA_SOLICITACAO:     ex \"17/03/2026\" | \"\"\n"
           "//   e  = ESTUDO_ELETRICO:      \"TEM\" | \"FALTA\" (derivado: status >= 2 => TEM)\n"
           "// Join por SGE (string) com ESCOLAS[].sge.\n"
           "const SUBESTACAO = {\n")
    corpo = ',\n'.join(
        '  "%s":{p:"%s",pa:"%s",n:"%s",pf:"%s",d:"%s",e:"%s"}' %
        (s, v['p'], v['pa'], v['n'], v['pf'], v['d'], v['e']) for s, v in sub.items())
    io.open(caminho, 'w', encoding='utf-8', newline='').write(cab + corpo + '\n};\n')

def escreve_mapa_sub(caminho, mapa):
    cab = ("// Gerado da BASE MESTRA - NAO editar a mao\n"
           "// SGE -> CATEGORIA (nova | aumento | falta_estudo | climatizada | liberada)\n")
    io.open(caminho, 'w', encoding='utf-8', newline='').write(
        cab + 'window.MAPA_SUB = ' + json.dumps(mapa, ensure_ascii=False, separators=(',', ':')) + ';\n')

def escreve_salas_prof(caminho, prof):
    cab = ("// Gerado da BASE MESTRA - NAO editar a mao.\n"
           "// SGE -> {s: situacao da sala dos professores, o: observacao}.\n"
           "// So alimenta a TAG da ficha. NAO entra na contagem de salas climatizadas:\n"
           "// a sala dos professores ja esta dentro de SALAS CLIMATIZADAS TOTAL, como\n"
           "// uma das administrativas. Somar aqui seria contar duas vezes.\n")
    io.open(caminho, 'w', encoding='utf-8', newline='').write(
        cab + 'window.SALAS_PROF = ' + json.dumps(prof, ensure_ascii=False, separators=(',', ':')) + ';\n')


# --------------------------------------------------------------- transformar
def transformar(linhas, atuais):
    dados = [r for r in linhas[1:]
             if str(r.get(COLS['sge'], '')).strip() and str(r.get(COLS['status'], '')).strip()]
    saida, avisos = [], []
    for r in dados:
        e = {}
        for campo in CAMPOS_TEXTO:
            e[campo] = txt(r.get(COLS[campo]))
        e['sge'] = txt(r.get(COLS['sge']))
        for campo in CAMPOS_MOEDA:
            bruto = str(r.get(COLS[campo], '')).strip()
            valor = num(bruto)
            if bruto and valor is None:
                avisos.append("SGE %s: %s tem texto no lugar de valor -> %r" % (e['sge'], campo, bruto))
            e[campo] = inteiro_se_puder(valor)
        e['lat'] = num(r.get(COLS['lat']))
        e['lng'] = num(r.get(COLS['lng']))
        e['geoSrc'] = 'planilha' if (e['lat'] is not None and e['lng'] is not None) else None
        # salas = SALAS TOTAL (CLIMATIZAVEIS), que na mestra e adm + pedagogicas
        e['salas'] = inteiro_se_puder(num(r.get(COL_SALAS)))
        if e['salas'] is None:
            avisos.append("SGE %s: sem numero de salas" % e['sge'])
        e['salasAdm']   = inteiro_se_puder(num(r.get(COL_SALAS_ADM)))
        e['salasPedag'] = inteiro_se_puder(num(r.get(COL_SALAS_PEDAG)))
        # quebra do medido: quantas das climatizadas sao administrativas e quantas pedagogicas.
        # Preenchimento parcial na mestra — 0 aqui significa "nao informado ainda", nao "nenhuma".
        e['salasAdmClim']   = inteiro_se_puder(num(r.get(COL_SALAS_ADM_CLIM)))
        e['salasPedagClim'] = inteiro_se_puder(num(r.get(COL_SALAS_PEDAG_CLIM)))
        # medido unidade por unidade; a sala dos professores JA esta contada aqui,
        # como uma das administrativas — nao somar de novo em lugar nenhum.
        e['salasClim']  = inteiro_se_puder(num(r.get(COL_SALAS_CLIM))) or 0
        if e['salas'] is not None and e['salasClim'] > e['salas']:
            avisos.append("SGE %s: %d salas climatizadas para %d salas no total"
                          % (e['sge'], e['salasClim'], e['salas']))
        antigo = atuais.get(e['sge'], {})
        for campo in CAMPOS_MANTIDOS:
            e[campo] = antigo.get(campo)
        saida.append({k: e.get(k) for k in ORDEM_SAIDA})
    return saida, avisos


# ------------------------------------------------------------------- validar
def validar(novos, atuais):
    erros = []
    if len(novos) != 512:
        erros.append("esperado 512 unidades no escopo, veio %d" % len(novos))
    sges = [e['sge'] for e in novos]
    dup = [k for k, v in collections.Counter(sges).items() if v > 1]
    if dup:
        erros.append("SGE duplicado: %s" % dup[:10])
    if not all(sges):
        erros.append("ha linha sem SGE")
    faltando = set(atuais) - set(sges)
    sobrando = set(sges) - set(atuais)
    if faltando:
        erros.append("SGE que existia no portal e sumiu: %s" % sorted(faltando)[:10])
    if sobrando:
        erros.append("SGE novo, precisa de conferencia manual: %s" % sorted(sobrando)[:10])
    fora = sorted({e['status'] for e in novos} - REGUA_STATUS)
    if fora:
        erros.append("status fora da regua: %s" % fora)
    semco = [e['sge'] for e in novos if e['lat'] is None or e['lng'] is None]
    if semco:
        erros.append("sem coordenada: %s" % semco[:10])
    ruins = [e['sge'] for e in novos
             if e['lat'] is not None and not (LAT_MIN <= e['lat'] <= LAT_MAX and LNG_MIN <= e['lng'] <= LNG_MAX)]
    if ruins:
        erros.append("coordenada fora de Fortaleza: %s" % ruins[:10])
    for e in novos:
        for campo in ('nome', 'bairro', 'distrito', 'tipo'):
            if not e.get(campo):
                erros.append("SGE %s sem %s" % (e['sge'], campo))
                break
    return erros


# ---------------------------------------------------------------------- saida
def escrever(caminho, blocos):
    """Reescreve SO as linhas window.<NOME> pedidas, preservando o resto byte a byte.
    blocos: {'ESCOLAS': [...], 'EXECUCAO': {...}}"""
    texto = io.open(caminho, encoding='utf-8', newline='').read()
    linhas = texto.split('\n')
    pendentes = set(blocos)
    for i, l in enumerate(linhas):
        for nome in list(pendentes):
            if l.startswith('window.' + nome):
                corpo = json.dumps(blocos[nome], ensure_ascii=False, separators=(',', ':'))
                linhas[i] = 'window.%s = %s;' % (nome, corpo)
                pendentes.discard(nome)
    if pendentes:
        raise SystemExit("linha(s) nao encontrada(s) em %s: %s" % (caminho, sorted(pendentes)))
    io.open(caminho, 'w', encoding='utf-8', newline='').write('\n'.join(linhas))


def carregar_atuais(caminho):
    texto = io.open(caminho, encoding='utf-8-sig', newline='').read()
    linha = [l for l in texto.split('\n') if l.startswith('window.ESCOLAS')][0]
    arr = json.loads(linha[linha.index('['):].rstrip().rstrip(';'))
    return {str(e['sge']): e for e in arr}


def main():
    if len(sys.argv) < 3:
        raise SystemExit("uso: importa_mestra.py <planilha.xlsx> <pasta web/data> [--gravar]")
    xlsx, pasta = sys.argv[1], sys.argv[2].rstrip('/\\')
    gravar = '--gravar' in sys.argv
    destino = pasta + '/dados.js'

    linhas = ler_mestra(xlsx)
    atuais = carregar_atuais(destino)
    novos, avisos = transformar(linhas, atuais)
    sub, mapa, prof = linhas_auxiliares(linhas)
    erros = validar(novos, atuais)

    print("unidades no escopo ....: %d" % len(novos))
    print("avisos de tipagem .....: %d" % len(avisos))
    for a in avisos[:8]:
        print("   %s" % a)
    if len(avisos) > 8:
        print("   ... e mais %d" % (len(avisos)-8))

    if erros:
        print("\nPORTAO DE VALIDACAO REPROVOU — nada foi gravado:")
        for e in erros:
            print("   x %s" % e)
        raise SystemExit(1)
    print("portao de validacao ...: OK")

    mudou = collections.Counter()
    for e in novos:
        a = atuais[e['sge']]
        for k in ORDEM_SAIDA:
            if a.get(k) != e.get(k):
                mudou[k] += 1
    print("\ncampos que mudam:")
    for k, v in mudou.most_common():
        print("   %-14s %3d unidades" % (k, v))

    excedidos, sem_orc, nao_fecham = audita_valores(linhas)
    def brl(v):
        return 'R$ ' + format(v, ',.2f').replace(',', 'X').replace('.', ',').replace('X', '.')
    print("\nauditoria de valores (regra: medido <= autorizado, sem aditivo):")
    if nao_fecham:
        print("   x TOTAL GASTO nao fecha com maquinas + servicos em %d unidades:" % len(nao_fecham))
        for sge, nome, t, p in nao_fecham[:5]:
            print("       SGE %-5s %-32s total=%s soma=%s" % (sge, nome[:32], brl(t), brl(p)))
    else:
        print("   ok  TOTAL GASTO fecha com maquinas + servicos em todas as unidades")
    if excedidos:
        print("   !   %d servico(s) com medido acima do autorizado (conferir se ha 2 A.S.):" % len(excedidos))
        for sge, nome, rot, o, m in sorted(excedidos, key=lambda x: x[4]-x[3], reverse=True):
            print("       SGE %-5s %-32s %-9s A.S.=%14s medido=%14s excedente=%s"
                  % (sge, nome[:32], rot, brl(o), brl(m), brl(m - o)))
    else:
        print("   ok  nenhum servico medido acima do autorizado")
    if sem_orc:
        print("   !   %d unidades com medicao e sem orcamento registrado (%s no total)"
              % (len(sem_orc), brl(sum(v for _, _, v in sem_orc))))

    print("\nauxiliares gerados:")
    print("   subestacao  %d SGE | estudo TEM=%d FALTA=%d"
          % (len(sub), sum(1 for v in sub.values() if v['e'] == 'TEM'),
             sum(1 for v in sub.values() if v['e'] == 'FALTA')))
    print("   mapa_sub    %d SGE | %s" % (len(mapa), dict(collections.Counter(mapa.values()))))
    print("   salas_prof  %d SGE" % len(prof))
    print("   salas totais: %d" % sum(e['salas'] or 0 for e in novos))

    execucao, sem_etapa = gera_execucao(linhas)
    gasto = sum(x['totalGasto'] or 0 for v in execucao.values() for x in v)
    print("   execucao    %d SGE | total gasto %s" % (len(execucao), brl(gasto)))
    if sem_etapa:
        print("   !   %d unidades com execucao e sem ETAPA (caem no periodo pelo status): %s"
              % (len(sem_etapa), ', '.join(sem_etapa[:8])))
    # como a etapa define o periodo no portal, mostra o deslocamento antes de gravar
    def periodo_de(sge, arr, status):
        etapas = [str(x.get('etapa') or '').upper() for x in arr]
        if any(t.startswith('ETAPA 01') for t in etapas): return '2025'
        if any(t.startswith('ETAPA 02') for t in etapas): return '2026'
        return 'antes' if nivel(status) in (9, 10) else '2027/2028'
    antes_p, depois_p = collections.Counter(), collections.Counter()
    st = {e['sge']: e['status'] for e in novos}
    exec_atual = {}
    _t = io.open(destino, encoding='utf-8-sig', newline='').read()
    for l in _t.split('\n'):
        if l.startswith('window.EXECUCAO'):
            exec_atual = json.loads(l.split('=', 1)[1].rstrip().rstrip(';').strip())
    for sge in st:
        antes_p[periodo_de(sge, exec_atual.get(sge, []), st[sge])] += 1
        depois_p[periodo_de(sge, execucao.get(sge, []), st[sge])] += 1
    print("   periodo (linha do tempo):")
    for k in ['antes', '2025', '2026', '2027/2028']:
        seta = '' if antes_p[k] == depois_p[k] else '   <-- muda'
        print("       %-10s %3d -> %3d%s" % (k, antes_p[k], depois_p[k], seta))

    if gravar:
        escrever(destino, {'ESCOLAS': novos, 'EXECUCAO': execucao})
        escreve_subestacao(pasta + '/subestacao.js', sub)
        escreve_mapa_sub(pasta + '/mapa_sub.js', mapa)
        escreve_salas_prof(pasta + '/salas_prof.js', prof)
        print("\ngravados: dados.js, subestacao.js, mapa_sub.js, salas_prof.js")
    else:
        print("\n(ensaio — use --gravar para escrever)")


if __name__ == '__main__':
    main()
