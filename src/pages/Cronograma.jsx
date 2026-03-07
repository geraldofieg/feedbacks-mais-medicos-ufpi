import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, CalendarDays, Clock, CheckCircle2, FileText, GraduationCap, Calendar, StickyNote, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumb from '../components/Breadcrumb';

export default function Cronograma() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [esconderPassados, setEsconderPassados] = useState(true);
  const [turmas, setTurmas] = useState([]);
  const [turmaAtiva, setTurmaAtiva] = useState(location.state?.turmaIdSelecionada || '');
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Busca as Turmas do Professor na Instituição
  useEffect(() => {
    async function fetchTurmas() {
      if (!currentUser || !escolaSelecionada?.id) return;
      try {
        const qT = query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
        const snapT = await getDocs(qT);
        const turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTurmas(turmasData);
        if (turmasData.length > 0 && !turmaAtiva) setTurmaAtiva(turmasData[0].id);
      } catch (error) { console.error("Erro buscar turmas:", error); }
    }
    fetchTurmas();
  }, [currentUser, escolaSelecionada]);

  // 2. Busca TODAS as Tarefas da Turma Ativa
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

  // Calculadora de Prazos Dinâmica
  const getStatusPrazo = (ts) => {
    if (!ts) return null;
    const dataFim = ts.toDate ? ts.toDate() : new Date(ts);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const fimDia = new Date(dataFim); fimDia.setHours(0, 0, 0, 0);
    
    const diff = fimDia.getTime() - hoje.getTime();
    const dias = Math.ceil(diff / (1000 * 3600 * 24));
    
    return {
      dataFormatada: dataFim.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      diasRestantes: dias,
      vencido: dias < 0,
      timestampVal: dataFim.getTime()
    };
  };

  const getEstiloCartao = (tipo) => {
    const t = (tipo || 'entrega').toLowerCase();
    if (t === 'compromisso') return { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-900', shadow: 'shadow-[0_0_10px_rgba(168,85,247,0.4)]', badge: 'bg-purple-600', icon: <Calendar size={18}/> };
    if (t === 'lembrete') return { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-900', shadow: 'shadow-[0_0_10px_rgba(59,130,246,0.4)]', badge: 'bg-blue-600', icon: <StickyNote size={18}/> };
    return { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-900', shadow: 'shadow-[0_0_10px_rgba(249,115,22,0.4)]', badge: 'bg-orange-500', icon: <FileText size={18}/> };
  };

  // Separação Inteligente: O que tem data vs O que não tem
  const itensComPrazo = tarefas
    .filter(t => t.dataFim)
    .map(t => ({ ...t, statusObj: getStatusPrazo(t.dataFim) }))
    .filter(t => !esconderPassados || t.statusObj.diasRestantes >= 0)
    .sort((a, b) => a.statusObj.timestampVal - b.statusObj.timestampVal); // Ordena do mais perto de vencer para o mais longe

  const itensSemPrazo = tarefas.filter(t => !t.dataFim);
    // Defesa UX Nível 1
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
              <CalendarDays className="text-blue-600" /> Cronograma Dinâmico
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            {turmas.length > 0 && (
              <select className="bg-white border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 py-2.5 px-4 font-bold shadow-sm outline-none" value={turmaAtiva} onChange={e => setTurmaAtiva(e.target.value)}>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            )}
            <button onClick={() => setEsconderPassados(!esconderPassados)} className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors shadow-sm ${esconderPassados ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {esconderPassados ? '👁️ Mostrar Passados' : '🙈 Ocultar Passados'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center animate-pulse font-bold text-gray-400">Montando calendário...</div>
        ) : tarefas.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <CalendarDays className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 font-medium text-lg">Nenhum evento programado para esta turma.</p>
            <p className="text-gray-400 text-sm mt-2">Vá na aba "Tarefas" para adicionar entregas, reuniões ou lembretes.</p>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* SEÇÃO 1: O RADAR (ITENS SEM DATA) */}
            {itensSemPrazo.length > 0 && (
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertCircle size={18}/> No Radar (Sem prazo definido)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {itensSemPrazo.map(item => {
                    const estilo = getEstiloCartao(item.tipo);
                    return (
                      <div key={item.id} className={`p-4 rounded-xl border transition-all hover:shadow-md bg-gray-50 border-gray-200 group`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`p-1.5 rounded-lg text-white ${estilo.badge}`}>{estilo.icon}</div>
                          <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{item.tipo || 'entrega'}</span>
                        </div>
                        <h4 className="font-bold text-gray-800 leading-tight mb-2">{item.nomeTarefa || item.titulo}</h4>
                        <p className="text-xs text-gray-500 italic line-clamp-3">{item.enunciado}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SEÇÃO 2: A LINHA DO TEMPO (ITENS COM DATA) */}
            {itensComPrazo.length > 0 && (
              <div className="relative border-l-2 border-gray-200 ml-4 md:ml-8 pl-6 md:pl-10 space-y-8">
                {itensComPrazo.map((item) => {
                  const status = item.statusObj;
                  const isAtual = status.diasRestantes >= 0 && status.diasRestantes <= 7; // Destaca o que vence nos próximos 7 dias
                  const isPassado = status.vencido;
                  const estilo = getEstiloCartao(item.tipo);

                  return (
                    <div key={item.id} className={`relative p-5 rounded-2xl border transition-all ${isAtual ? `${estilo.bg} ${estilo.border} shadow-md transform scale-[1.02]` : 'bg-white border-gray-200'}`}>
                      
                      {/* Bolinha da Timeline */}
                      <div className={`absolute -left-[35px] md:-left-[51px] top-6 w-6 h-6 rounded-full border-4 border-gray-50 z-10 ${isAtual ? `${estilo.badge} ${estilo.shadow}` : isPassado ? 'bg-gray-300' : 'bg-gray-200'}`}></div>

                      {/* Badge Superior */}
                      {isAtual && (
                        <span className={`absolute -top-3 left-6 text-white px-3 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm ${estilo.badge}`}>
                          <Clock size={12}/> VENCE EM {status.diasRestantes} DIAS
                        </span>
                      )}
                      {isPassado && <span className="absolute -top-3 left-6 bg-gray-200 text-gray-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Passado / Vencido</span>}
                      {!isAtual && !isPassado && <span className="absolute -top-3 left-6 bg-gray-100 text-gray-500 border border-gray-200 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"><CalendarDays size={12}/> Faltam {status.diasRestantes} dias</span>}

                      <div className={`mt-2 ${isPassado ? 'opacity-60' : ''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {estilo.icon}
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{item.tipo || 'entrega'}</span>
                        </div>
                        
                        <h3 className={`text-lg sm:text-xl font-black mb-2 ${isAtual ? estilo.text : 'text-gray-800'}`}>
                          {item.nomeTarefa || item.titulo}
                        </h3>
                        
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-500 bg-gray-100/50 inline-flex px-3 py-1.5 rounded-lg border border-gray-100 mt-1">
                          <Clock size={16} className="text-gray-400"/>
                          Data final: {status.dataFormatada}
                        </div>

                        {item.enunciado && (
                          <div className="mt-4 p-3 bg-white rounded-xl border border-gray-100 text-sm shadow-sm font-medium text-gray-600">
                            {item.enunciado}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
        }
