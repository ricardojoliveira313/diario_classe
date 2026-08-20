import { useEffect, useState } from 'react';
import { api, supabase } from '../api';
import { Loading } from '../components';
import MatriculasMensais from '../components/MatriculasMensais';
import { useAno } from '../AnoContext';
import { sortTurmasPedagogico, theme } from '../styles';
import { useAuth } from '../AuthContext';

export default function Genero() {
  const { role } = useAuth();
  const { ano, setAno } = useAno();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getTurmas(), api.getAllAlunos()])
      .then(([turmasDb, alunosDb]) => {
        setTurmas(sortTurmasPedagogico(turmasDb ?? []));
        setAlunos(alunosDb ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const atualizarSexo = async (ids: string[], sexo: 'M' | 'F') => {
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
    for (let i = 0; i < lista.length; i += 100) {
      const { error } = await supabase.from('Aluno').update({ sexo }).in('id', lista.slice(i, i + 100));
      if (error) throw error;
    }
    setAlunos(atuais => atuais.map(aluno => idsFinais.has(String(aluno.id)) ? { ...aluno, sexo } : aluno));
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
      <MatriculasMensais
        alunos={alunos}
        turmas={turmas}
        ano={ano}
        onAnoChange={setAno}
        onAtualizarSexo={atualizarSexo}
        somenteConsulta={role !== 'admin'}
      />
    </div>
  );
}
