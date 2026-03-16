import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, CalendarDays, Clock, CheckCircle2, GraduationCap, Calendar, AlertCircle, BookOpen, LayoutList, PlayCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumb from '../components/Breadcrumb';

// IMPORTAÇÃO DAS EMENTAS ESTÁTICAS
import { ementaMaisMedicos } from '../data/ementaMaisMedicos';
import { ementaUFPA } from '../data/ementaUFPA';

export default function Cronograma() {
  const { currentUser, userProfile, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [abaAtiva, setAbaAtiva] = useState('agenda'); 
  const [esconderPassados, setEsconderPassados] = useState(true);
  const [turmas, setTurmas] = useState([]);
  const [turmaAtiva, setTurmaAtiva] = useState(() => {
    return location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || '';
  });
  const [tarefas, setTarefas] = useState([]);
  const [progressoTarefas, setProgressoTarefas] = useState({});
  const [loading, setLoading] = useState(true);

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  useEffect(() => {
    async function fetchTurmas() {
      if (!currentUser || !escolaSelecionada?.id) return;
      try {
        const qT = isAdmin
          ? query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id))
          : query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
        
        const snapT = await getDocs(qT);
        const turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTurmas(turmasData);
        
        const targetTurma = location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || turmaAtiva;
        const isValid = turmasData.some(t => t.id === targetTurma);
        
        if (isValid) {
          if (targetTurma !== turmaAtiva) setTurmaAtiva(targetTurma);
        } else if (turmasData.length > 0) {
          setTurmaAtiva(turmasData[0].id);
        }
      } catch (error) { console.error("Erro buscar turmas:", error); }
    }
    fetchTurmas();
  }, [currentUser, escolaSelecionada, isAdmin, turmaAtiva]);

  useEffect(() => {
    async function fetchTarefasEProgresso() {
      if (!turmaAtiva) { setTarefas([]); setProgressoTarefas({}); setLoading(false); return; }
      setLoading(true);
      try {
        const qA = query(collection(db, 'tarefas'), where('turmaId', '==', turmaAtiva));
        const snapA = await getDocs(qA);
        setTarefas(snapA.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira'));

        const qAtiv = query(collection(db, 'atividades'), where('turmaId', '==', turmaAtiva));
        const snapAtiv = await getDocs(qAtiv);
        
        let progressoLocal = {};
        snapAtiv.docs.forEach(doc => {
          const ativ = doc.data();
          const temResposta = (ativ.resposta && String(ativ.resposta).trim() !== '') || !!ativ.arquivoUrl;
          if (temResposta || ativ.status === 'aprovado' || ativ.postado === true) {
            progressoLocal[ativ.tarefaId] = true;
          }
        });
        setProgressoTarefas(progressoLocal);
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }
    fetchTarefasEProgresso();
  }, [turmaAtiva]);

  const getStatusPrazo = (tsInicio, tsFim) => {
    if (!tsFim) return null;
    const dataFim = tsFim.toDate ? tsFim.toDate() : new Date(tsFim);
    const dataInicio = tsInicio ? (tsInicio.toDate ? tsInicio.toDate() : new Date(tsInicio)) : null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diff = dataFim.getTime() - hoje.getTime();
    const dias = Math.ceil(diff / (1000 * 3600 * 24));
    let status = dias < 0 ? 'passado' : (dataInicio && hoje >= dataInicio && hoje <= dataFim ? 'atual' : 'futuro');

    return { dataFormatada: `${dataInicio ? dataInicio.toLocaleDateString('pt-BR') : '...'} até ${dataFim.toLocaleDateString('pt-BR')}`, diasRestantes: dias, status, timestampVal: dataFim.getTime() };
  };

  const itensComPrazo = tarefas
    .filter(t => t.dataFim)
    .map(t => ({ ...t, statusObj: getStatusPrazo(t.dataInicio, t.dataFim) }))
    .filter(t => !esconderPassados || t.statusObj.status !== 'passado')
    .sort((a, b) => a.statusObj.timestampVal - b.statusObj.timestampVal);
  
  const turmaObj = turmas.find(t => t.id === turmaAtiva);
  const faculdadeNome = escolaSelecionada?.nome?.trim().toUpperCase();
  const isTurmaMaisMedicos = (faculdadeNome === 'UFPI' || faculdadeNome === 'UFPA') && turmaObj?.nome?.trim().includes('Facilitador');
  const ementaParaExibir = faculdadeNome === 'UFPA' ? ementaUFPA : ementaMaisMedicos;

  if (!escolaSelecionada?.id) return <div className="p-20 text-center font-bold text-gray-400">Selecione uma instituição...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumb items={[{ label: `Cronograma (${escolaSelecionada.nome})` }]} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4 mb-6">
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><CalendarDays className="text-blue-600" /> Cronograma Oficial</h2>
          {turmas.length > 0 && (
            <select className="bg-white border rounded-full py-2 px-4 font-bold text-sm outline-none" value={turmaAtiva} onChange={e => setTurmaAtiva(e.target.value)}>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          )}
        </div>

        {isTurmaMaisMedicos && (
          <div className="flex bg-gray-200/50 p-1.5 rounded-2xl mb-8">
            <button onClick={() => setAbaAtiva('agenda')} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${abaAtiva === 'agenda' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>Agenda</button>
            <button onClick={() => setAbaAtiva('guia')} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${abaAtiva === 'guia' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'}`}>Ficha Técnica (PDF)</button>
          </div>
        )}

        {abaAtiva === 'agenda' ? (
          <div>
            <div className="flex justify-end mb-6">
              <button onClick={() => setEsconderPassados(!esconderPassados)} className="px-4 py-2 rounded-full text-xs font-bold bg-white border">{esconderPassados ? '👁️ Mostrar Módulos Passados' : '🙈 Ocultar Passados'}</button>
            </div>
            {tarefas.length === 0 ? <div className="p-20 text-center font-bold text-gray-400">Nenhum evento...</div> : (
              <div className="relative border-l-2 ml-4 md:ml-8 pl-6 md:pl-10 space-y-10">
                {itensComPrazo.map((item) => {
                  const { status, diasRestantes, dataFormatada } = item.statusObj;
                  return (
                    <div key={item.id} className="relative group">
                      <div className={`absolute -left-[35px] md:-left-[51px] top-6 w-6 h-6 rounded-full border-4 ${status === 'atual' ? 'bg-blue-500 shadow-lg' : 'bg-gray-300'}`}></div>
                      <div className={`p-6 rounded-2xl border bg-white ${status === 'atual' ? 'border-blue-300 shadow-md' : 'opacity-70'}`}>
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase">{item.tipo || 'ATIVIDADE'}</p>
                            <h3 className="text-xl font-black text-gray-800">{item.nomeTarefa || item.titulo}</h3>
                            <p className="text-sm font-bold text-gray-500"><Calendar size={14} className="inline mr-1" />{dataFormatada}</p>
                          </div>
                          <Link to={`/revisar/${item.id}`} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black text-sm self-center">Corrigir</Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {ementaParaExibir.map((eixo, idx) => (
              <div key={idx} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="bg-slate-800 p-4"><h3 className="text-white font-black">{eixo.eixo}</h3></div>
                <div className="divide-y">
                  {eixo.modulos.map((mod, i) => (
                    <div key={i} className="p-5">
                      <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-1 rounded">MÓDULO {mod.num}</span>
                      <h4 className="font-black text-lg text-gray-800">{mod.titulo}</h4>
                      <p className="text-xs font-bold text-gray-400 uppercase mt-2">{mod.ch}h • {mod.creditos} créditos</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
