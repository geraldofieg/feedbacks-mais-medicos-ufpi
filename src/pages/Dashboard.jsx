import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ArrowRight, GraduationCap, Users, LayoutDashboard, Building2, UserPlus, FileText, ChevronRight, Trash2, Pencil, Check, X, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, escolaSelecionada, setEscolaSelecionada } = useAuth();
  const navigate = useNavigate();
  
  const [instituicoes, setInstituicoes] = useState([]);
  const [novaInstituicao, setNovaInstituicao] = useState('');
  const [loadingInst, setLoadingInst] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [editandoInstId, setEditandoInstId] = useState(null);
  const [nomeInstEdicao, setNomeInstEdicao] = useState('');

  const [minhasTurmas, setMinhasTurmas] = useState([]);
  const [estatisticas, setEstatisticas] = useState({ alunos: 0, pendencias: 0 });
  const [loadingDados, setLoadingDados] = useState(false);
  
  const [proximosEventos, setProximosEventos] = useState([]);

  useEffect(() => {
    setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
  }, [escolaSelecionada]);

  useEffect(() => {
    async function fetchInstituicoes() {
      if (!currentUser) return;
      try {
        const instList = [];
        const qInst = query(collection(db, 'instituicoes'), where('professorUid', '==', currentUser.uid));
        const snapInst = await getDocs(qInst);
        snapInst.docs.forEach(d => {
          const data = d.data();
          if (data.status !== 'lixeira') instList.push({ id: d.id, nome: data.nome });
        });
        const listaOrdenada = instList.sort((a, b) => a.nome.localeCompare(b.nome));
        setInstituicoes(listaOrdenada);
        if (listaOrdenada.length === 1 && !escolaSelecionada) setEscolaSelecionada(listaOrdenada[0]);
      } catch (error) { console.error("Erro buscar instituições:", error); } 
      finally { setLoadingInst(false); }
    }
    fetchInstituicoes();
  }, [currentUser, escolaSelecionada, setEscolaSelecionada]);

  useEffect(() => {
    async function fetchDadosDashboard() {
      if (!currentUser || !escolaSelecionada?.id) return;
      setLoadingDados(true);
      try {
        const qTurmas = query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
        const snapTurmas = await getDocs(qTurmas);
        const turmasData = snapTurmas.docs.map(t => ({ id: t.id, ...t.data() })).filter(t => t.status !== 'lixeira');
        setMinhasTurmas(turmasData);

        let totalAlunos = 0;
        if (turmasData.length > 0) {
          const turmasIds = turmasData.map(d => d.id);
          const qAlunos = query(collection(db, 'alunos'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapAlunos = await getDocs(qAlunos);
          totalAlunos = snapAlunos.docs.filter(a => turmasIds.includes(a.data().turmaId) && a.data().status !== 'lixeira').length;

          const qTarefas = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapTarefas = await getDocs(qTarefas);
          
          const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
          const limite = new Date(hoje); limite.setDate(hoje.getDate() + 7); 

          const tarefasFiltradas = snapTarefas.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(t => t.status !== 'lixeira' && turmasIds.includes(t.turmaId) && t.dataFim)
            .map(t => {
              const dataF = t.dataFim.toDate ? t.dataFim.toDate() : new Date(t.dataFim);
              dataF.setHours(0,0,0,0);
              return { ...t, objDataFim: dataF, timestamp: dataF.getTime() };
            })
            .filter(t => t.timestamp >= hoje.getTime() && t.timestamp <= limite.getTime())
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, 3); 
            
          setProximosEventos(tarefasFiltradas);
        } else {
          setEstatisticas({ alunos: 0, pendencias: 0 });
          setProximosEventos([]);
        }

        setEstatisticas({ alunos: totalAlunos, pendencias: 0 }); 
      } catch (error) { console.error("Erro buscar dados:", error); } 
      finally { setLoadingDados(false); }
    }
    if (escolaSelecionada) fetchDadosDashboard();
  }, [currentUser, escolaSelecionada]);

  async function handleCriarAcessar(e) {
    e.preventDefault(); const nomeInst = novaInstituicao.trim(); if (!nomeInst) return;
    try { setSalvando(true); const docRef = await addDoc(collection(db, 'instituicoes'), { nome: nomeInst, professorUid: currentUser.uid, status: 'ativa', dataCriacao: serverTimestamp() }); setEscolaSelecionada({ id: docRef.id, nome: nomeInst }); } 
    catch (error) { console.error("Erro:", error); } finally { setSalvando(false); }
  }
  async function handleSalvarEdicaoInst(e, id) {
    e.stopPropagation(); if (!nomeInstEdicao.trim()) return;
    try { await updateDoc(doc(db, 'instituicoes', id), { nome: nomeInstEdicao.trim() }); setInstituicoes(instituicoes.map(inst => inst.id === id ? { ...inst, nome: nomeInstEdicao.trim() } : inst)); setEditandoInstId(null); if (escolaSelecionada?.id === id) setEscolaSelecionada({ id, nome: nomeInstEdicao.trim() }); } 
    catch (error) { console.error("Erro editar:", error); }
  }
  async function handleLixeiraInstituicao(e, id, nome) {
    e.stopPropagation(); if (!window.confirm(`Apagar o espaço "${nome}"?\n\nEle será enviado para a lixeira.`)) return;
    try { await updateDoc(doc(db, 'instituicoes', id), { status: 'lixeira' }); setInstituicoes(instituicoes.filter(inst => inst.id !== id)); } 
    catch (error) { console.error("Erro:", error); }
  }
  
  const temTurmas = minhasTurmas.length > 0;
    if (!escolaSelecionada) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 mt-4 md:mt-8">
        <div className="text-center mb-10">
          <div className="bg-blue-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"><GraduationCap size={32} /></div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight">Bem-vindo(a)!</h1>
          <p className="text-gray-500 mt-2 text-base md:text-lg px-2">Selecione o seu ambiente de trabalho para continuar.</p>
        </div>

        <div className="flex flex-col gap-8 w-full max-w-2xl mx-auto">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><LayoutDashboard size={18}/> Suas Instituições Ativas</h2>
            {loadingInst ? ( <div className="text-gray-400 text-sm font-medium animate-pulse text-center py-6">Carregando...</div> ) : instituicoes.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200"><p className="text-gray-500 text-sm font-medium">Nenhuma instituição cadastrada.</p></div>
            ) : (
              <div className="space-y-3">
                {instituicoes.map(inst => (
                  <div key={inst.id} className="w-full bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between hover:bg-blue-600 hover:text-white transition-all group cursor-pointer shadow-sm" onClick={() => setEscolaSelecionada(inst)}>
                    {editandoInstId === inst.id ? (
                      <div className="flex items-center gap-2 w-full pr-2" onClick={e => e.stopPropagation()}>
                        <input type="text" value={nomeInstEdicao} onChange={(e) => setNomeInstEdicao(e.target.value)} className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800" autoFocus />
                        <button onClick={(e) => handleSalvarEdicaoInst(e, inst.id)} className="bg-green-500 text-white p-1.5 rounded-lg hover:bg-green-600 shadow-sm"><Check size={16}/></button>
                        <button onClick={(e) => { e.stopPropagation(); setEditandoInstId(null); }} className="bg-gray-200 text-gray-600 p-1.5 rounded-lg hover:bg-gray-300"><X size={16}/></button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-left font-black text-blue-800 group-hover:text-white text-lg truncate">{inst.nome}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); setEditandoInstId(inst.id); setNomeInstEdicao(inst.nome); }} className="p-2 text-blue-400 hover:text-white hover:bg-blue-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><Pencil size={18} /></button>
                          <button onClick={(e) => handleLixeiraInstituicao(e, inst.id, inst.nome)} className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                          <div className="p-2 text-blue-600 group-hover:text-white ml-1"><ArrowRight size={24} /></div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
             <h2 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2"><Plus size={18}/> Cadastrar Novo Vínculo</h2>
            <form onSubmit={handleCriarAcessar} className="flex gap-2">
              <input type="text" required placeholder="Ex: Meu Cursinho..." className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 transition-colors font-medium outline-none" value={novaInstituicao} onChange={(e) => setNovaInstituicao(e.target.value)} />
              <button type="submit" disabled={salvando} className="bg-gray-800 text-white font-bold py-3 px-6 rounded-xl hover:bg-gray-900 disabled:opacity-50 transition-all shadow-sm">{salvando ? '...' : 'Criar'}</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8 justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3 w-full">
          <div className="bg-blue-100 text-blue-700 p-3 rounded-xl shadow-sm shrink-0"><GraduationCap size={28} /></div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-gray-800 leading-tight">Centro de Comando</h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-gray-500 text-sm font-medium">Instituição:</span>
              <select className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 py-1 px-2 font-bold cursor-pointer max-w-[200px] sm:max-w-xs truncate outline-none" value={escolaSelecionada.id}
                onChange={(e) => { const val = e.target.value; if (val === 'NOVA') setEscolaSelecionada(null); else { const inst = instituicoes.find(i => i.id === val); if (inst) setEscolaSelecionada(inst); } }}
              >
                {instituicoes.map(inst => <option key={inst.id} value={inst.id}>{inst.nome}</option>)}
                <option disabled>──────────</option>
                <option value="NOVA">+ Nova Instituição</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {!temTurmas && !loadingDados && (
        <div className="mb-10 text-center bg-blue-50 border-2 border-dashed border-blue-200 p-10 rounded-3xl max-w-2xl mx-auto">
          <Building2 className="mx-auto text-blue-400 mb-4" size={48}/>
          <h2 className="text-xl font-black text-blue-900 mb-2">Vamos configurar sua instituição?</h2>
          <p className="text-blue-700 font-medium mb-6">Para começar a organizar suas tarefas e alunos, você precisa criar sua primeira turma.</p>
          <Link to="/turmas" className="inline-flex items-center gap-2 bg-blue-600 text-white font-black py-3 px-8 rounded-xl shadow-lg hover:bg-blue-700 transition-all"><Plus size={20}/> Criar Nova Turma</Link>
        </div>
      )}

      {temTurmas && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          
          <div className="lg:col-span-2">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              Minhas Turmas <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-black">{minhasTurmas.length}</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {minhasTurmas.map(turma => (
                <Link key={turma.id} to="/tarefas" state={{ turmaIdSelecionada: turma.id }} className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm hover:border-blue-400 hover:shadow-md transition-all group flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-gray-800 text-lg group-hover:text-blue-700 transition-colors line-clamp-1">{turma.nome}</h3>
                    <p className="text-xs text-gray-400 mt-1 font-medium">Ver tarefas e pendências</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"><ChevronRight size={20}/></div>
                </Link>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar size={18}/> Radar da Semana
            </h2>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {proximosEventos.length === 0 ? (
                <div className="p-6 text-center">
                  <Clock className="mx-auto text-gray-300 mb-2" size={32}/>
                  <p className="text-sm font-bold text-gray-400">Nenhum evento para os próximos 7 dias.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {/* A MÁGICA DOS LINKS ACONTECE AQUI */}
                  {proximosEventos.map(evento => {
                    const isEntrega = (evento.tipo || 'entrega').toLowerCase() === 'entrega';
                    const ConteudoCartao = (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${evento.tipo === 'compromisso' ? 'bg-purple-500' : 'bg-orange-500'}`}></span>
                          <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{evento.tipo || 'entrega'}</span>
                        </div>
                        <h4 className={`font-bold text-sm truncate ${isEntrega ? 'text-orange-700 group-hover:underline' : 'text-gray-800'}`}>
                          {evento.nomeTarefa || evento.titulo}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1 font-medium flex items-center gap-1">
                          <Clock size={12}/> {evento.objDataFim.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        </p>
                      </>
                    );

                    // Se for Entrega, o cartão vira um Link. Se não, é só uma div normal.
                    return isEntrega ? (
                      <Link key={evento.id} to={`/revisar/${evento.id}`} className="block p-4 hover:bg-orange-50 transition-colors group cursor-pointer border-l-2 border-transparent hover:border-orange-400">
                        {ConteudoCartao}
                      </Link>
                    ) : (
                      <div key={evento.id} className="p-4 hover:bg-gray-50 transition-colors">
                        {ConteudoCartao}
                      </div>
                    );
                  })}
                </div>
              )}
              <Link to="/datas" className="block w-full text-center bg-gray-50 p-3 text-xs font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors uppercase tracking-widest border-t border-gray-100">
                Ver Calendário Completo
              </Link>
            </div>
          </div>

        </div>
      )}

      <div className="border-t border-gray-200 pt-8 opacity-70 hover:opacity-100 transition-opacity">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Visão Geral</h2>
        <div className="flex flex-wrap gap-4">
          <div className="bg-white px-4 py-3 rounded-xl border border-gray-100 flex-1 min-w-[150px] flex items-center justify-between shadow-sm">
            <span className="text-gray-500 text-sm font-bold flex items-center gap-2"><Users size={16}/> Alunos</span>
            <span className="font-black text-gray-800">{loadingDados ? '...' : estatisticas.alunos}</span>
          </div>
          <div className="bg-white px-4 py-3 rounded-xl border border-gray-100 flex-1 min-w-[150px] flex items-center justify-between shadow-sm">
            <span className="text-gray-500 text-sm font-bold flex items-center gap-2"><LayoutDashboard size={16}/> Pendências Ativas</span>
            <span className="font-black text-gray-800">-</span>
          </div>
        </div>
      </div>

    </div>
  );
}
