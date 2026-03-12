import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, CalendarDays, Clock, CheckCircle2, GraduationCap, Calendar, StickyNote, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumb from '../components/Breadcrumb';

export default function Cronograma() {
  const { currentUser, userProfile, escolaSelecionada } = useAuth();
  const location = useLocation();
  
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, escolaSelecionada, isAdmin]);

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

  const getStatusPrazo = (ts) => {
    if (!ts) return null;
    const dataFim = ts.toDate ? ts.toDate() : new Date(ts);
    const hoje = new Date(); 
    hoje.setHours(0, 0, 0, 0); 
    const fimDia = new Date(dataFim); 
    fimDia.setHours(0, 0, 0, 0); 
    
    const diff = fimDia.getTime() - hoje.getTime();
    const dias = Math.ceil(diff / (1000 * 3600 * 24));
    
    return {
      dataFormatada: dataFim.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      diasRestantes: dias,
      vencido: dias < 0,
      timestampVal: dataFim.getTime()
    };
  };

  const getEstiloCartao = (tipo) => {
    const t = (tipo || 'entrega').toLowerCase();
    if (t === 'compromisso') return { icon: <Calendar size={14}/>, label: 'COMPROMISSO' };
    if (t === 'lembrete') return { icon: <StickyNote size={14}/>, label: 'POST-IT' };
    return { icon: null, label: 'ATIVIDADE' };
  };

  const itensComPrazo = tarefas
    .filter(t => t.dataFim)
    .map(t => ({ ...t, statusObj: getStatusPrazo(t.dataFim) }))
    .filter(t => !esconderPassados || t.statusObj.diasRestantes >= 0)
    .sort((a, b) => a.statusObj.timestampVal - b.statusObj.timestampVal); 
    
  const itensSemPrazo = tarefas.filter(t => !t.dataFim);
  
  if (!escolaSelecionada?.id) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: 'Cronograma' }]} />
        <div className="bg-blue-50 border-2 border-dashed border-blue-200 p-12 rounded-3xl text-center max-w-2xl mx-auto mt-10 shadow-sm">
          <GraduationCap className="mx-auto text-blue-400 mb-4" size={56} />
          <h2 className="text-2xl font-black text-blue-800 mb-2">Instituição não selecionada</h2>
          <p className="text-blue-600 mb-8 font-medium text-lg">Para visualizar o cronograma de atividades, selecione a sua instituição de trabalho.</p>
          <Link to="/" className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-black py-4 px-10 rounded-xl hover:bg-blue-700 transition-all shadow-lg">Ir para o Centro de Comando</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        <Breadcrumb items={[{ label: `Cronograma (${escolaSelecionada.nome})` }]} />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4 mb-8">
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
            <button onClick={() => setEsconderPassados(!esconderPassados)} className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors shadow-sm ${esconderPassados ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}>
              {esconderPassados ? '👁️ Mostrar Módulos Passados' : '🙈 Ocultar Passados'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center animate-pulse font-black text-gray-400 text-lg">Montando calendário...</div>
        ) : tarefas.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200 shadow-sm">
            <CalendarDays className="mx-auto text-gray-300 mb-6" size={48} />
            <h3 className="text-2xl font-black text-gray-800 mb-2">Cronograma Vazio!</h3>
            <p className="text-gray-500 font-medium text-lg">Nenhum evento programado para esta turma.</p>
            <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">Vá na aba "Tarefas" para adicionar tarefas de entrega, compromissos ou post-its.</p>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* LINHA DO TEMPO (STYLE V1 CLEAN) */}
            {itensComPrazo.length > 0 && (
              <div className="relative border-l-2 border-gray-200 ml-4 md:ml-8 pl-6 md:pl-10 space-y-8">
                {itensComPrazo.map((item) => {
                  const status = item.statusObj;
                  const isPassado = status.vencido;
                  const isAtual = status.diasRestantes >= 0 && status.diasRestantes <= 7;
                  
                  const isEntrega = (item.tipo || 'entrega').toLowerCase() === 'entrega';
                  const estilo = getEstiloCartao(item.tipo);

                  const ConteudoCartao = (
                    <>
                      {/* O Ponto na Linha do Tempo */}
                      <div className={`absolute -left-[35px] md:-left-[51px] top-6 w-6 h-6 rounded-full border-4 border-gray-50 z-10 ${isAtual ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : isPassado ? 'bg-gray-300' : 'bg-gray-200'}`}></div>

                      {/* Botão Superior (Para Tarefas) */}
                      {!isPassado && isEntrega && (
                        <span className="absolute top-4 right-4 text-gray-400 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-gray-50 px-2 py-1 rounded border border-gray-100 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                          Ir para Correção &rarr;
                        </span>
                      )}

                      {/* Selo (Badge) de Urgência */}
                      {isAtual && (
                        <span className="absolute -top-3 left-6 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <Clock size={12}/> EM ANDAMENTO (Faltam {status.diasRestantes} dias)
                        </span>
                      )}
                      {isPassado && <span className="absolute -top-3 right-6 md:right-auto md:left-6 bg-gray-200 text-gray-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Concluído</span>}

                      <div className={`mt-2 pr-24 ${isPassado ? 'opacity-60' : ''}`}>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          {estilo.icon} {estilo.label}
                        </p>
                        
                        <h3 className={`text-xl font-black mb-2 ${isAtual ? 'text-blue-900 group-hover:underline' : 'text-gray-800'}`}>
                          {item.nomeTarefa || item.titulo}
                        </h3>
                        
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-500 bg-gray-100/50 inline-flex px-3 py-1.5 rounded-lg border border-gray-100">
                          <CalendarDays size={16} />
                          Prazo final: {status.dataFormatada}
                        </div>

                        {item.enunciado && (
                          <div className="mt-4 text-sm font-medium text-gray-500 whitespace-pre-wrap">
                            {item.enunciado}
                          </div>
                        )}
                      </div>
                    </>
                  );

                  return isEntrega ? (
                    <Link key={item.id} to={`/revisar/${item.id}`} className={`block relative p-5 rounded-2xl border transition-all group cursor-pointer ${isAtual ? 'bg-blue-50 border-blue-300 shadow-md transform scale-[1.02]' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                      {ConteudoCartao}
                    </Link>
                  ) : (
                    <div key={item.id} className={`relative p-5 rounded-2xl border transition-all ${isAtual ? 'bg-blue-50 border-blue-300 shadow-md transform scale-[1.02]' : 'bg-white border-gray-200'}`}>
                      {ConteudoCartao}
                    </div>
                  );
                })}
              </div>
            )}

            {/* RADAR / POST-ITS (Sem Data) */}
            {itensSemPrazo.length > 0 && (
              <div className="bg-gray-100/50 p-6 rounded-3xl border border-gray-200 mt-16">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertCircle size={18}/> Lembretes e Post-its (Sem Prazo)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {itensSemPrazo.map(item => {
                    const estilo = getEstiloCartao(item.tipo);
                    return (
                      <div key={item.id} className="p-5 rounded-2xl border transition-all hover:shadow-md bg-white border-gray-200">
                        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                          {estilo.icon} {estilo.label}
                        </div>
                        <h4 className="font-bold text-gray-800 leading-tight mb-2 text-lg">{item.nomeTarefa || item.titulo}</h4>
                        <p className="text-sm text-gray-500 font-medium whitespace-pre-wrap line-clamp-4">{item.enunciado}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
