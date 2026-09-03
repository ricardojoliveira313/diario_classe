import { useEffect, useMemo, useState } from 'react';
import { api, supabase } from '../api';
import { Loading } from '../components';
import MatriculasMensais from '../components/MatriculasMensais';
import { useAno } from '../AnoContext';
import { sortTurmasPedagogico, theme } from '../styles';
import { useAuth } from '../AuthContext';
import { sugerirSexoPeloNome } from '../nomesGenero';

export default function Genero() {
  const { role, username } = useAuth();
  const { ano, setAno } = useAno();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [corrigindoSuspeito, setCorrigindoSuspeito] = useState('');

  useEffect(() => {
    Promise.all([api.getTurmas(), api.getAllAlunos()])
      .then(([turmasDb, alunosDb]) => {
        setTurmas(sortTurmasPedagogico(turmasDb ?? []));
        setAlunos(alunosDb ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  // manual=true (padrão): veio de um clique humano de conferência — marca
  // sexo_confirmado_manual pra blindar contra "Aplicar sexo oficial" do
  // Educacenso sobrescrever de novo numa próxima importação. manual=false é
  // usado só pelo próprio "Aplicar sexo oficial" (aplicação em lote do
  // cruzamento), que não deve contar como confirmação humana.
  const atualizarSexo = async (ids: string[], sexo: 'M' | 'F', manual = true) => {
    const idsFinais = new Set(ids.map(String));
    const ras = new Set(
      alunos
        .filter(aluno => idsFinais.has(String(aluno.id)) && aluno.ra)
        .map(aluno => String(aluno.ra)),
    );
    alunos.forEach(aluno => {
      if (aluno.ra && ras.has(String(aluno.ra))) idsFinais.add(String(aluno.id));
    });
    const lista = [...idsFinais];
    const payload: Record<string, unknown> = manual ? { sexo, sexo_confirmado_manual: true } : { sexo };
    for (let i = 0; i < lista.length; i += 100) {
      const { error } = await supabase.from('Aluno').update(payload).in('id', lista.slice(i, i + 100));
      if (error) throw error;
    }
    setAlunos(atuais => atuais.map(aluno => idsFinais.has(String(aluno.id)) ? { ...aluno, ...payload } : aluno));
  };

  // Achado real (ago/2026): um clique errado na conferência em lote deixou uma
  // "Alice" marcada como menino, sem nenhum jeito de perceber depois. Cruza o
  // sexo já salvo com a sugestão pelo primeiro nome (mesma lista curada usada
  // na conferência em lote) e avisa quando os dois batem em direções opostas —
  // não corrige sozinho, só aponta pra conferência.
  const suspeitosSexoTrocado = useMemo(() => {
    const turmaMap = new Map(turmas.map(turma => [turma.id, turma.nome]));
    return alunos
      .filter(aluno => (!aluno.situacao || aluno.situacao === 'ATIVO') && (aluno.sexo === 'M' || aluno.sexo === 'F'))
      .map(aluno => ({ aluno, sugestao: sugerirSexoPeloNome(aluno.nome) }))
      .filter(({ aluno, sugestao }) => sugestao && sugestao !== aluno.sexo)
      .map(({ aluno, sugestao }) => ({ id: String(aluno.id), nome: aluno.nome, ra: aluno.ra, turma: turmaMap.get(aluno.turmaId) ?? 'Sem turma', atual: aluno.sexo as 'M' | 'F', sugestao: sugestao as 'M' | 'F' }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [alunos, turmas]);

  const corrigirSuspeito = async (id: string, sexo: 'M' | 'F') => {
    setCorrigindoSuspeito(id);
    try {
      await atualizarSexo([id], sexo);
    } finally {
      setCorrigindoSuspeito('');
    }
  };

  if (loading) return <Loading />;

  return (
    <div style={{ animation: 'fadeIn 0.25s ease both' }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 26, color: theme.text }}>👫 Gênero</h1>
        <p style={{ margin: '5px 0 0', color: theme.textSecondary, fontSize: 13 }}>
          Cruzamento criterioso entre a base SED do aplicativo e o relatório oficial do Educacenso, com totais de meninos e meninas e divergências separadas para conferência.
        </p>
        <div style={{ marginTop: 9, padding: '9px 11px', border: `1px solid ${theme.borderLight}`, borderRadius: theme.radius, background: theme.card, color: theme.textSecondary, fontSize: 12.5 }}>
          {role === 'admin' ? <>
            <strong>Ordem correta:</strong> 1) envie os PDFs/Excel mais recentes da SED na aba{' '}
            <a href="/importar" style={{ color: theme.primaryText, fontWeight: 800, textDecoration: 'underline' }}>Importar</a>; 2) volte aqui e selecione o relatório Educacenso. Assim o cruzamento compara duas bases atualizadas da mesma data de referência.
          </> : <>
            <strong>Modo consulta:</strong> os dados da SED e do Educacenso são atualizados exclusivamente pela administração. Você pode filtrar as informações e emitir relatórios em PDF ou Excel.
          </>}
        </div>
      </div>
      {suspeitosSexoTrocado.length > 0 && (
        <div style={{ marginBottom: 16, border: `1px solid ${theme.orange}88`, borderRadius: theme.radius, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: `${theme.orange}12`, borderBottom: `1px solid ${theme.orange}55` }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: theme.text }}>⚠️ Confira: sexo pode estar trocado ({suspeitosSexoTrocado.length})</div>
            <div style={{ marginTop: 3, fontSize: 12, color: theme.textSecondary }}>
              O sexo salvo para estes alunos não bate com o que o primeiro nome costuma indicar (ex.: "Alice" marcada como menino). Não corrige sozinho — confira e clique no que estiver certo.
            </div>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {suspeitosSexoTrocado.map((item, indice) => (
              <div key={item.id} style={{
                display: 'grid', gridTemplateColumns: 'minmax(210px, 1fr) minmax(120px, .45fr) auto',
                alignItems: 'center', gap: 10, padding: '8px 12px',
                background: indice % 2 === 0 ? 'transparent' : theme.bg,
                borderBottom: `1px solid ${theme.borderLight}`,
              }}>
                <div>
                  <div style={{ color: theme.text, fontWeight: 700 }}>{item.nome}</div>
                  <div style={{ color: theme.textSecondary, fontSize: 11.5 }}>RA: {item.ra || 'não informado'} · salvo como {item.atual === 'M' ? 'menino' : 'menina'}</div>
                </div>
                <div style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 600 }}>{item.turma}</div>
                {role === 'admin' ? (
                  <button type="button" disabled={!!corrigindoSuspeito} onClick={() => corrigirSuspeito(item.id, item.sugestao)}
                    className="report-action report-action-warning">
                    {corrigindoSuspeito === item.id ? 'Salvando…' : `Corrigir para ${item.sugestao === 'M' ? 'menino' : 'menina'}`}
                  </button>
                ) : <span />}
              </div>
            ))}
          </div>
        </div>
      )}
      <MatriculasMensais
        alunos={alunos}
        turmas={turmas}
        ano={ano}
        onAnoChange={setAno}
        onAtualizarSexo={atualizarSexo}
        somenteConsulta={role !== 'admin'}
        username={username}
      />
    </div>
  );
}
