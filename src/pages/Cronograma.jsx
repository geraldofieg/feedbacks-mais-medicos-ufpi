import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, CalendarDays, Clock, CheckCircle2, GraduationCap, Calendar, StickyNote, AlertCircle, FileText, BookOpen, LayoutList } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumb from '../components/Breadcrumb';

// IMPORTAMOS O ARQUIVO EXTERNO (Limpa o código principal)
import { ementaMaisMedicos } from '../data/ementaMaisMedicos';

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
  const [loading, setLoading] = useState(true);

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  useEffect(() => {
    if (location.state?.turmaIdSelecionada && location.state.turmaIdSelecionada !== turmaAtiva) {
      setTurmaAtiva(location.state.turmaIdSelecionada);
    }
  }, [location.state, turmaAtiva]);

  useEffect(() => {
    if (turmaAtiva) localStorage.setItem('ultimaTurmaAtiva', turmaAtiva);
  }, [turmaAtiva]);

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
  }, [currentUser, escolaSelecionada, isAdmin, location.state?.turmaIdSelecionada, turmaAtiva]);

  useEffect(() => {
    async function fetchTarefas() {
      if (!turmaAtiva) { setTarefas([]); setLoading(false); return; }
      setLoading(true);
      try {
        const qA = query(collection(db, 'tarefas'), where('turmaId', '==', turmaAtiva));
        const snapA = await getDocs(qA);
        const tarefasData = snapA.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTarefas(tarefasData);
      } catch (error) { console.error("Erro buscar tarefas:", error); } 
      finally { setLoading(false); }
    }
    fetchTarefas();
  }, [turmaAtiva]);

  const getStatusPrazo = (tsInicio, tsFim) => {
    if (!tsFim) return null;
    const dataFim = tsFim.toDate ? tsFim.toDate() : new Date(tsFim);
    const dataInicio = tsInicio ? (tsInicio.toDate ? tsInicio.toDate() : new Date(tsInicio)) : null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const fimDia = new Date(dataFim);
    fimDia.setHours(0, 0, 0, 0);

    const diff = fimDia.getTime() - hoje.getTime();
    const dias = Math.ceil(diff / (1000 * 3600 * 24));

    let status = 'futuro';
    if (dias < 0) status = 'passado';
    else if (dataInicio && hoje >= dataInicio && hoje <= dataFim) status = 'atual';
    else if (!dataInicio && dias <= 7) status = 'atual';

    return {
      dataFormatada: `${dataInicio ? dataInicio.toLocaleDateString('pt-BR') : '...'} até ${dataFim.toLocaleDateString('pt-BR')}`,
      diasRestantes: dias,
      status: status,
      timestampVal: dataFim.getTime()
    };
  };

  const itensComPrazo = tarefas
    .filter(t => t.dataFim)
    .map(t => ({ ...t, statusObj: getStatusPrazo(t.dataInicio, t.dataFim) }))
    .filter(t => !esconderPassados || t.statusObj.status !== 'passado')
    .sort((a, b) => a.statusObj.timestampVal - b.statusObj.timestampVal); 

  const itensSemPrazo = tarefas.filter(t => !t.dataFim);

  // SEGURANÇA BLINDADA: Só abre a aba premium para a dupla exata.
  const turmaObj = turmas.find(t => t.id === turmaAtiva);
  const isTurmaMaisMedicos = escolaSelecionada?.nome?.trim() === 'UFPI' && turmaObj?.nome?.trim() === 'Facilitador Mais Médico';

  if (!escolaSelecionada?.id) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: 'Cronograma' }]} />
        <div className="bg-blue-50 border-2 border-dashed border-blue-200 p-12 rounded-3xl text-center max-w-2xl mx-auto mt-10 shadow-sm">
          <GraduationCap className="mx-auto text-blue-400 mb-4" size={56} />
          <h2 className="text-2xl font-black text-blue-800 mb-2">Instituição não selecionada</h2>
          <p className="text-blue-600 mb-8 font-medium text-lg">Selecione uma instituição para ver o cronograma.</p>
          <Link to="/" className="bg-blue-600 text-white font-black py-4 px-10 rounded-xl shadow-lg">Ir para Início</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumb items={[{ label: `Cronograma (${escolaSelecionada.nome})` }]} />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4 mb-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-400 hover:text-blue-600 transition-colors bg-white p-2 rounded-xl border border-gray-200 shadow-sm hidden md:block"><ArrowLeft size={20} /></Link>
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <CalendarDays className="text-blue-600" /> Cronograma Oficial
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            {turmas.length > 0 && (
              <select className="bg-white border border-gray-200 text-gray-700 text-sm rounded-full py-2 px-4 font-bold shadow-sm outline-none cursor-pointer" value={turmaAtiva} onChange={e => setTurmaAtiva(e.target.value)}>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* TABS SÓ APARECEM SE FOR MAIS MÉDICOS (Pacote Premium) */}
        {isTurmaMaisMedicos && (
          <div className="flex bg-gray-200/50 p-1.5 rounded-2xl mb-8">
            <button 
              onClick={() => setAbaAtiva('agenda')} 
              className={`flex-1 py-3 rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-all ${abaAtiva === 'agenda' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutList size={18} /> Agenda de Entregas (Turma)
            </button>
            <button 
              onClick={() => setAbaAtiva('guia')} 
              className={`flex-1 py-3 rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-all ${abaAtiva === 'guia' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BookOpen size={18} /> Cronograma Assíncrono (PDF)
            </button>
          </div>
        )}

        {/* CONTEÚDO DA ABA 1: AGENDA DE ENTREGAS (Sempre visível por padrão) */}
        {(!isTurmaMaisMedicos || abaAtiva === 'agenda') && (
          <div>
            <div className="flex justify-end mb-6">
              <button onClick={() => setEsconderPassados(!esconderPassados)} className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors shadow-sm ${esconderPassados ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}>
                {esconderPassados ? '👁️ Mostrar Módulos Passados' : '🙈 Ocultar Passados'}
              </button>
            </div>

            {loading ? (
              <div className="p-10 text-center animate-pulse font-black text-gray-400 text-lg">Montando calendário...</div>
            ) : tarefas.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200 shadow-sm">
                <CalendarDays className="mx-auto text-gray-300 mb-6" size={48} />
                <h3 className="text-2xl font-black text-gray-800 mb-2">Cronograma Vazio!</h3>
                <p className="text-gray-500 font-medium text-lg">Nenhum evento programado para esta turma.</p>
              </div>
            ) : (
              <div className="space-y-10">
                {itensComPrazo.length > 0 && (
                  <div className="relative border-l-2 border-gray-200 ml-4 md:ml-8 pl-6 md:pl-10 space-y-10">
                    {itensComPrazo.map((item) => {
                      const { status, diasRestantes, dataFormatada } = item.statusObj;
                      const isAtual = status === 'atual';
                      const isPassado = status === 'passado';

                      return (
                        <div key={item.id} className="relative group">
                          <div className={`absolute -left-[35px] md:-left-[51px] top-6 w-6 h-6 rounded-full border-4 border-gray-50 z-10 transition-all ${isAtual ? 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)] scale-110' : isPassado ? 'bg-gray-300' : 'bg-gray-200'}`}></div>

                          {isAtual && (
                            <span className="absolute -top-3 left-6 bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md z-20">
                              <Clock size={12}/> EM ANDAMENTO (Faltam {diasRestantes} dias)
                            </span>
                          )}
                          
                          {isPassado && <span className="absolute -top-3 left-6 bg-gray-200 text-gray-500 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 z-20"><CheckCircle2 size={12}/> CONCLUÍDO</span>}

                          <Link 
                            to={item.tipo === 'entrega' ? `/revisar/${item.id}` : '#'} 
                            className={`block p-6 rounded-2xl border transition-all ${isAtual ? 'bg-blue-50 border-blue-300 shadow-lg transform scale-[1.01]' : 'bg-white border-gray-200 hover:border-blue-200'} ${isPassado ? 'opacity-60' : ''}`}
                          >
                            <div className="mt-1">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                {item.tipo === 'entrega' ? 'ATIVIDADE ACADÊMICA' : item.tipo?.toUpperCase() || 'ATIVIDADE'}
                              </p>
                              <h3 className={`text-xl font-black mb-3 ${isAtual ? 'text-blue-900' : 'text-gray-800'}`}>
                                {item.nomeTarefa || item.titulo}
                              </h3>
                              <div className="flex items-center gap-2 text-sm font-bold text-gray-500 bg-white/50 inline-flex px-3 py-1.5 rounded-lg border border-gray-100">
                                <Calendar size={16} className={isAtual ? 'text-blue-500' : 'text-gray-400'} />
                                {dataFormatada}
                              </div>
                            </div>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}

                {itensSemPrazo.length > 0 && (
                  <div className="bg-gray-100/50 p-6 rounded-3xl border border-gray-200 mt-20">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <AlertCircle size={18}/> Lembretes e Post-its (Sem Prazo)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {itensSemPrazo.map(item => (
                        <div key={item.id} className="p-5 rounded-2xl border bg-white border-gray-200">
                          <h4 className="font-bold text-gray-800 text-lg mb-1">{item.nomeTarefa || item.titulo}</h4>
                          <p className="text-sm text-gray-500 line-clamp-3">{item.enunciado}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CONTEÚDO DA ABA 2: CRONOGRAMA ASSÍNCRONO (SÓ P/ MAIS MÉDICOS) */}
        {isTurmaMaisMedicos && abaAtiva === 'guia' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="bg-purple-50 border border-purple-200 p-5 rounded-2xl flex items-start gap-4 mb-8">
              <BookOpen className="text-purple-500 shrink-0 mt-1" size={24} />
              <div>
                <h3 className="font-black text-purple-900 text-lg">Ficha Técnica Oficial (Mais Médicos)</h3>
                <p className="text-purple-700 text-sm font-medium mt-1">Benefício exclusivo do seu pacote. Este é o documento oficial de referência com eixos, horas e créditos.</p>
              </div>
            </div>

            {ementaMaisMedicos.map((eixoObj, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                <div className="bg-slate-800 p-4 border-b border-slate-700">
                  <h3 className="text-white font-black text-lg tracking-wide">{eixoObj.eixo}</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {eixoObj.modulos.map((mod, i) => (
                    <div key={i} className="p-5 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-black bg-purple-100 text-purple-700 px-2 py-1 rounded mb-2 inline-block">MÓDULO {mod.num}</span>
                          <h4 className="text-gray-800 font-black text-lg leading-tight">{mod.titulo}</h4>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-center bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                            <span className="block text-[10px] font-black text-gray-400 uppercase">Horas</span>
                            <span className="font-black text-gray-700">{mod.ch}h</span>
                          </div>
                          <div className="text-center bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                            <span className="block text-[10px] font-black text-gray-400 uppercase">Créditos</span>
                            <span className="font-black text-gray-700">{mod.creditos}</span>
                          </div>
                          <div className="text-center bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                            <span className="block text-[10px] font-black text-gray-400 uppercase">Semanas</span>
                            <span className="font-black text-gray-700">{mod.semanas}</span>
                          </div>
                        </div>
                      </div>
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
