import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Clock, CheckCircle, ChevronRight, CheckCheck, Send, Filter, XCircle } from 'lucide-react';

export default function ListaAtividades() {
  const { status } = useParams();
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para as listas de filtros
  const [modulosList, setModulosList] = useState([]);
  const [tarefasList, setTarefasList] = useState([]);
  
  // Estados para os valores selecionados nos filtros
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroTarefa, setFiltroTarefa] = useState('');

  const titulos = {
    'pendente': 'Aguardando Revisão',
    'falta-postar': 'Falta Postar no Site',
    'finalizados': 'Histórico Finalizado'
  };

  useEffect(() => {
    // Busca módulos e tarefas para carregar os menus de filtro
    const unsubModulos = onSnapshot(query(collection(db, 'modulos'), orderBy('nome', 'asc')), (snap) => {
      setModulosList(snap.docs.map(doc => doc.data().nome));
    });
    const unsubTarefas = onSnapshot(query(collection(db, 'tarefas'), orderBy('nome', 'asc')), (snap) => {
      setTarefasList(snap.docs.map(doc => doc.data().nome));
    });

    const statusBanco = status === 'pendente' ? 'pendente' : 'aprovado';
    const q = query(collection(db, 'atividades'), where('status', '==', statusBanco));

    const unsubAtividades = onSnapshot(q, (snap) => {
      let lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (status === 'falta-postar') {
        lista = lista.filter(atv => !atv.postado);
      } else if (status === 'finalizados') {
        lista = lista.filter(atv => atv.postado === true);
      }
      
      lista.sort((a, b) => {
        if (status === 'finalizados' || status === 'falta-postar') {
            const dateA = a.dataAprovacao?.seconds || 0;
            const dateB = b.dataAprovacao?.seconds || 0;
            return dateB - dateA;
        }
        return (b.dataCriacao?.seconds || 0) - (a.dataCriacao?.seconds || 0);
      });
      setAtividades(lista);
      setLoading(false);
    }, (error) => { console.error(error); setLoading(false); });

    return () => { unsubModulos(); unsubTarefas(); unsubAtividades(); };
  }, [status]);

  // Lógica de Filtragem em Tempo Real
  const atividadesFiltradas = atividades.filter(atv => {
    const bateModulo = filtroModulo === '' || atv.modulo === filtroModulo;
    const bateTarefa = filtroTarefa === '' || atv.tarefa === filtroTarefa;
    return bateModulo && bateTarefa;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Cabeçalho */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors"><ArrowLeft size={24} /></Link>
          <h2 className="text-2xl font-bold text-gray-800 capitalize">{titulos[status]}</h2>
        </div>

        {/* BARRA DE FILTROS (NOVA) */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-6 space-y-4">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-sm mb-2">
            <Filter size={18} /> <span>Filtrar Busca</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Filtro de Módulo */}
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase mb-1">Por Módulo:</label>
              <select 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                value={filtroModulo}
                onChange={(e) => setFiltroModulo(e.target.value)}
              >
                <option value="">Todos os Módulos</option>
                {modulosList.map((m, i) => <option key={i} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Filtro de Tarefa */}
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase mb-1">Por Tarefa:</label>
              <select 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                value={filtroTarefa}
                onChange={(e) => setFiltroTarefa(e.target.value)}
              >
                <option value="">Todas as Tarefas</option>
                {tarefasList.map((t, i) => <option key={i} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Botão para limpar filtros (só aparece se houver filtro ativo) */}
          {(filtroModulo || filtroTarefa) && (
            <button 
              onClick={() => { setFiltroModulo(''); setFiltroTarefa(''); }}
              className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 transition-colors mt-2"
            >
              <XCircle size={14} /> Limpar Filtros
            </button>
          )}
        </div>

        {/* Listagem */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-blue-600 font-medium">Buscando informações...</div>
        ) : atividadesFiltradas.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl text-center border-2 border-dashed border-gray-200 text-gray-500">
            {atividades.length > 0 ? 'Nenhum resultado para os filtros selecionados.' : 'Nenhuma atividade nesta etapa.'}
          </div>
        ) : (
          <div className="grid gap-4">
            {atividadesFiltradas.map((atv) => {
              let corBorda = status === 'pendente' ? 'border-yellow-200' : status === 'falta-postar' ? 'border-blue-300 shadow-md' : 'border-gray-200 opacity-80';
              let corIcone = status === 'pendente' ? 'bg-yellow-50 text-yellow-600' : status === 'falta-postar' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600';
              let icone = status === 'pendente' ? <Clock size={24} /> : status === 'falta-postar' ? <Send size={24} /> : <CheckCheck size={24} />;

              return (
                <Link key={atv.id} to={`/revisar/${atv.id}`} className={`bg-white p-5 rounded-2xl border flex justify-between items-center active:scale-95 transition-all group ${corBorda}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${corIcone}`}>{icone}</div>
                    <div>
                      <h3 className={`font-bold ${status === 'finalizados' ? 'text-gray-500' : 'text-gray-900'}`}>{atv.aluno}</h3>
                      <p className="text-sm text-gray-500 font-medium">{atv.modulo} • {atv.tarefa}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {status === 'pendente' ? 'Criado em: ' : 'Aprovado em: '}
                        {new Date(((status === 'pendente' ? atv.dataCriacao?.seconds : atv.dataAprovacao?.seconds) || 0) * 1000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500"><ChevronRight size={20} /></div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
