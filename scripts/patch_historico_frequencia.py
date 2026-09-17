from pathlib import Path
import re

path = Path('frontend/src/pages/Historico.tsx')
s = path.read_text(encoding='utf-8')

old_import = "import { btn, input, label, theme, contarDiasLetivosPeriodo } from '../styles';"
new_import = "import { btn, input, label, theme, contarDiasLetivosPeriodo, getFeriado, isRecesso, isSabadoLetivo } from '../styles';"
if old_import in s:
    s = s.replace(old_import, new_import, 1)
elif new_import not in s:
    raise SystemExit('Import esperado não encontrado')

if 'function calcularAusenciasNoPeriodo(' not in s:
    marker = '\nfunction TabelaNotas('
    if marker not in s:
        raise SystemExit('Ponto de inserção dos helpers não encontrado')
    helpers = r'''

interface FaltaPeriodoHistorico {
  mes: number;
  ano: number;
  faltas: number | null;
  frequencia: string | null;
}

function emendasDoAno(ano: number): Set<string> {
  try {
    const valor = JSON.parse(localStorage.getItem(`emendas-${ano}`) || '[]');
    return new Set(Array.isArray(valor) ? valor.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function diasLetivosDoMesHistorico(ano: number, mes: number): number[] {
  const emendas = emendasDoAno(ano);
  const totalDias = new Date(ano, mes, 0).getDate();
  const dias: number[] = [];
  for (let dia = 1; dia <= totalDias; dia += 1) {
    const diaSemana = new Date(ano, mes - 1, dia).getDay();
    const fimDeSemana = diaSemana === 0 || diaSemana === 6;
    const dataISO = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const letivo = !getFeriado(ano, mes, dia)
      && !isRecesso(ano, mes, dia)
      && !emendas.has(dataISO)
      && (!fimDeSemana || isSabadoLetivo(ano, mes, dia));
    if (letivo) dias.push(dia);
  }
  return dias;
}

function calcularAusenciasNoPeriodo(
  registros: FaltaPeriodoHistorico[],
  inicioISO: string,
  fimISO: string,
): { ausencias: number; usouFallbackMensal: boolean } {
  let ausencias = 0;
  let usouFallbackMensal = false;

  for (const registro of registros) {
    const ano = Number(registro.ano);
    const mes = Number(registro.mes);
    if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) continue;

    const ultimoDia = new Date(ano, mes, 0).getDate();
    const prefixo = `${ano}-${String(mes).padStart(2, '0')}`;
    const inicioMes = `${prefixo}-01`;
    const fimMes = `${prefixo}-${String(ultimoDia).padStart(2, '0')}`;
    if (fimMes < inicioISO || inicioMes > fimISO) continue;

    const frequencia = String(registro.frequencia ?? '');
    if (frequencia.startsWith('DIAS:')) {
      const estados = frequencia.slice(5).split('');
      const diasLetivos = diasLetivosDoMesHistorico(ano, mes);
      diasLetivos.forEach((dia, indice) => {
        const dataISO = `${prefixo}-${String(dia).padStart(2, '0')}`;
        if (dataISO < inicioISO || dataISO > fimISO) return;
        const estado = estados[indice] ?? 'P';
        if (estado === 'F' || estado === 'J' || estado === 'A') ausencias += 1;
      });
      continue;
    }

    ausencias += Math.max(0, Number(registro.faltas ?? 0) || 0);
    usouFallbackMensal = true;
  }

  return { ausencias, usouFallbackMensal };
}
'''
    s = s.replace(marker, helpers + marker, 1)

pattern = re.compile(
    r"  const calcularDiasLetivosPeriodo = \(\) => \{.*?\n  \};\n\n  const buscarComRA = async",
    re.S,
)
replacement = r'''  const calcularDiasLetivosPeriodo = async () => {
    setErroCalculoDiasLetivos(null);
    if (!transferenciaDataInicio || !transferenciaDataFim) {
      setErroCalculoDiasLetivos('Informe a data de início e a data de fim do período.');
      return;
    }
    const total = contarDiasLetivosPeriodo(transferenciaDataInicio, transferenciaDataFim);
    if (total === null) {
      setErroCalculoDiasLetivos('Período inválido — confira se a data de fim é depois da data de início.');
      return;
    }

    setTransferenciaDiasLetivos(String(total));
    if (!transferenciaPeriodo.trim()) {
      setTransferenciaPeriodo(`${formatarData(transferenciaDataInicio)} a ${formatarData(transferenciaDataFim)}`);
    }

    if (aluno?.id) {
      const { data: faltasPeriodo, error: faltasPeriodoError } = await supabase
        .from('Falta')
        .select('mes, ano, faltas, frequencia')
        .eq('alunoId', aluno.id);

      if (faltasPeriodoError) {
        setErroCalculoDiasLetivos(`Dias letivos calculados, mas não foi possível buscar as faltas: ${faltasPeriodoError.message}`);
      } else {
        const { ausencias, usouFallbackMensal } = calcularAusenciasNoPeriodo(
          (faltasPeriodo ?? []) as FaltaPeriodoHistorico[],
          transferenciaDataInicio,
          transferenciaDataFim,
        );
        setTransferenciaAusencias(String(ausencias));
        setTransferenciaPresencas(String(Math.max(0, total - ausencias)));
        if (usouFallbackMensal) {
          setAviso('Presenças e ausências foram preenchidas automaticamente. Há registro antigo com total mensal; confira o total antes de imprimir.');
        }
      }
    } else {
      setTransferenciaAusencias('0');
      setTransferenciaPresencas(String(total));
    }

    setAlteradoSemSalvar(true);
  };

  const buscarComRA = async'''
s2, count = pattern.subn(replacement, s, count=1)
if count != 1:
    raise SystemExit(f'Função calcularDiasLetivosPeriodo não localizada de forma única: {count}')
s = s2

s = s.replace(
    'Preenche "Dias Letivos" (e "Período Letivo", se estiver vazio) usando o calendário oficial — feriados, recessos e sábados letivos.',
    'Preenche automaticamente Dias Letivos, Presenças e Ausências usando o calendário oficial e os registros da aba Faltas.',
)

path.write_text(s, encoding='utf-8')
