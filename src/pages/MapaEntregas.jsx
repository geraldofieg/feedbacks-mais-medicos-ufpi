import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, ClipboardList, CheckCircle, Clock, XCircle, ChevronRight } from 'lucide-react';

export default function MapaEntregas() {
  const [alunos, setAlunos] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [modulosList, setModulosList] = useState([]);
  const [tarefasList, setTarefasList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [moduloFiltro, setModuloFiltro] = useState('');
  const [tarefaFiltro, setTarefaFiltro] = useState('');

  useEffect(() => {
    // Busca Alunos em ordem alfabética
    const unsubAlunos = onSnapshot(query(collection(db, 'alunos'), orderBy('nome', 'asc')), (snap) => {
      setAlunos(snap.docs.map(doc => doc.data().nome));
    });

    // Busca todas as atividades para cruzar os dados
    const unsubAtividades = onSnapshot(collection(db, 'atividades'), (snap) => {
      setAtividades(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Busca os Módulos que você cadastrou nas Configurações
    const unsubModulos = onSnapshot(query(collection(db, 'modulos'), orderBy('nome', 'asc')), (snap) => {
      setModulosList(snap.docs.map(doc => doc.data().nome));
    });

    // Busca as Tarefas (como a "Atividade 01") do seu Firebase
    const unsubTarefas = onSnapshot(query(collection(db, 'tarefas'), orderBy('nome', 'asc')), (snap) => {
      setTarefasList(snap.docs.map(doc => doc.data().nome));
      setLoading(false);
    });

    return () => { unsubAlunos(); unsubAtividades(); unsubModulos(); unsubTarefas(); };
  }, []);

  const verificarStatus = (nomeAluno) => {
    if (!moduloFiltro || !tarefaFiltro) return null;
    
    const atividade = atividades.find(a => 
      a.aluno === nomeAluno && 
      a.modulo === moduloFiltro && 
      a.tarefa === tarefaFiltro
    );

    if (!atividade) return { status: 'falta', texto: 'Não Entregue', corBG: 'bg-red-50', corTexto: 'text-red-700', icone: <XCircle size={18} className="text-red-500" /> };
    if (atividade.status === 'pendente') return { status: 'pendente', texto: 'Aguardando Revisão', corBG: 'bg-yellow-50', corTexto: 'text-yellow-800', icone: <Clock size={18} className="text-yellow-500" />, id: atividade.id };
    return { status: 'aprovado', texto: 'Aprovado', corBG: 'bg-green-50', corTexto: 'text-green-800', icone: <CheckCircle size={18} className="text-green-500" />, id: atividade.id };
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors"><ArrowLeft size={24} /></Link>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><ClipboardList className="text-blue-600" /> Mapa de Entregas</h2>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
          <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Selecione a Tarefa para ver a turma</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select className="w-full p-3 border border-gray-300 rounded-lg bg-white" value={moduloFiltro} onChange={e => setModuloFiltro(e.target.value)}>
              <option value="">-- Escolha o Módulo --</option>
              {modulosList.map((m, i) => <option key={i} value={m}>{m}</option>)}
            </select>
            <select className="w-full p-3 border border-gray-300 rounded-lg bg-white" value={tarefaFiltro} onChange={e => setTarefaFiltro(e.target.value)}>
              <option value="">-- Escolha a Tarefa --</option>
              {tarefasList.map((t, i) => <option key={i} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando dados...</div>
          ) : !moduloFiltro || !tarefaFiltro ? (
            <div className="p-10 text-center text-gray-500">Selecione o Módulo e a Tarefa acima para visualizar o status.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {alunos.map((nome, i) => {
                const info = verificarStatus(nome);
                return (
                  <div key={i} className={`p-4 flex justify-between items-center transition-colors ${info.corBG}`}>
                    <div className="flex items-center gap-3">
                      {info.icone}
                      <div>
                        <h3 className="font-bold text-gray-800">{nome}</h3>
                        <span className={`text-xs font-bold uppercase ${info.corTexto}`}>{info.texto}</span>
                      </div>
                    </div>
                    {info.status === 'pendente' && (
                      <Link to={`/revisar/${info.id}`} className="text-blue-600 font-bold text-sm bg-white border border-blue-200 px-3 py-2 rounded-lg shadow-sm hover:bg-blue-50">Revisar</Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
