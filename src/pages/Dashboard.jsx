import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ArrowRight, GraduationCap, Users, LayoutDashboard, Building2, UserPlus, FileText, ChevronRight, Trash2, Pencil, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, escolaSelecionada, setEscolaSelecionada } = useAuth();
  
  const [instituicoes, setInstituicoes] = useState([]);
  const [novaInstituicao, setNovaInstituicao] = useState('');
  const [loadingInst, setLoadingInst] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Estados de Edição da Instituição
  const [editandoInstId, setEditandoInstId] = useState(null);
  const [nomeInstEdicao, setNomeInstEdicao] = useState('');

  // Estados do Dashboard Real
  const [minhasTurmas, setMinhasTurmas] = useState([]);
  const [estatisticas, setEstatisticas] = useState({ alunos: 0, pendencias: 0 });
  const [loadingDados, setLoadingDados] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }, [escolaSelecionada]);

  // Busca Instituições (Agora roda sempre, para alimentar o Dropdown)
  useEffect(() => {
    async function fetchInstituicoes() {
      if (!currentUser) return;
      try {
        const instList = [];
        const qInst = query(collection(db, 'instituicoes'), where('professorUid', '==', currentUser.uid));
        const snapInst = await getDocs(qInst);
        
        snapInst.docs.forEach(d => {
          const data = d.data();
          if (data.status !== 'lixeira') {
            instList.push({ id: d.id, nome: data.nome });
          }
        });

        setInstituicoes(instList.sort((a, b) => a.nome.localeCompare(b.nome)));
      } catch (error) {
        console.error("Erro ao buscar instituições:", error);
      } finally {
        setLoadingInst(false);
      }
    }
    fetchInstituicoes();
  }, [currentUser]);

  // Busca Dados Reais do Dashboard
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
        }

        setEstatisticas({ alunos: totalAlunos, pendencias: 0 });
      } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
      } finally {
        setLoadingDados(false);
      }
    }

    if (escolaSelecionada) {
      fetchDadosDashboard();
    }
  }, [currentUser, escolaSelecionada]);

  // Criar Instituição
  async function handleCriarAcessar(e) {
    e.preventDefault();
    const nomeInst = novaInstituicao.trim();
    if (!nomeInst) return;

    try {
      setSalvando(true);
      
      const docRef = await addDoc(collection(db, 'instituicoes'), {
        nome: nomeInst,
        professorUid: currentUser.uid,
        status: 'ativa',
        dataCriacao: serverTimestamp()
      });

      setEscolaSelecionada({ id: docRef.id, nome: nomeInst });
    } catch (error) {
      console.error("Erro ao salvar instituição:", error);
      alert("Ocorreu um erro. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  // Editar Nome da Instituição
  async function handleSalvarEdicaoInst(e, id) {
    e.stopPropagation();
    if (!nomeInstEdicao.trim()) return;
    try {
      await updateDoc(doc(db, 'instituicoes', id), { nome: nomeInstEdicao.trim() });
      setInstituicoes(instituicoes.map(inst => inst.id === id ? { ...inst, nome: nomeInstEdicao.trim() } : inst));
      setEditandoInstId(null);
      // Atualiza o contexto se for a escola atual
      if (escolaSelecionada?.id === id) {
        setEscolaSelecionada({ id, nome: nomeInstEdicao.trim() });
      }
    } catch (error) {
      console.error("Erro ao editar instituição:", error);
    }
  }

  // Soft Delete de Instituição
  async function handleLixeiraInstituicao(e, id, nome) {
    e.stopPropagation(); 
    if (!window.confirm(`Tem certeza que deseja apagar o espaço "${nome}"?\n\nEle será enviado para a lixeira e você perderá o acesso a todas as turmas cadastradas nele.`)) return;

    try {
      await updateDoc(doc(db, 'instituicoes', id), { status: 'lixeira' });
      setInstituicoes(instituicoes.filter(inst => inst.id !== id));
    } catch (error) {
      console.error("Erro ao enviar instituição para a lixeira:", error);
    }
  }

  function selecionarInstituicao(instObj) {
    setEscolaSelecionada(instObj);
  }

  // ==========================================
  // TELA 1: O PORTEIRO
  // ==========================================
  if (!escolaSelecionada) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 mt-4 md:mt-8">
        <div className="text-center mb-10">
          <div className="bg-blue-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <GraduationCap size={32} /> 
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight">Bem-vindo(a)!</h1>
          <p className="text-gray-500 mt-2 text-base md:text-lg px-2">
            Para começar a usar a plataforma, você precisa criar ou selecionar uma <strong>Instituição</strong>.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 w-full">
          <div className="w-full md:w-1/2 bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-black text-gray-800 mb-2 flex items-center gap-2">
              <Plus className="text-blue-600"/> Criar Instituição
            </h2>
            <p className="text-gray-500 text-sm mb-6 font-medium">Cadastre a faculdade, curso ou escola onde você leciona.</p>
            
            <form onSubmit={handleCriarAcessar} className="space-y-4">
              <div>
                <input
                  type="text" required placeholder="Ex: Meu Cursinho, Mais Médicos..."
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors font-medium"
                  value={novaInstituicao} onChange={(e) => setNovaInstituicao(e.target.value)}
                />
              </div>
              <button type="submit" disabled={salvando} className="w-full bg-blue-600 text-white font-black py-3.5 px-4 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md flex justify-center items-center gap-2">
                {salvando ? 'Salvando...' : <>Criar Instituição <ArrowRight size={18}/></>}
              </button>
            </form>
          </div>

          <div className="w-full md:w-1/2 bg-gray-50 p-6 sm:p-8 rounded-2xl border border-gray-200">
            <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
              <LayoutDashboard className="text-gray-500"/> Minhas Instituições
            </h2>
            
            {loadingInst ? (
              <div className="text-gray-500 text-sm font-medium animate-pulse">Buscando cadastros...</div>
            ) : instituicoes.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm font-medium italic">Você ainda não possui nenhuma instituição ativa.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                {instituicoes.map(inst => (
                  <div key={inst.id} className="w-full bg-white border border-gray-200 p-3 pl-4 rounded-xl flex items-center justify-between hover:border-blue-500 hover:shadow-sm transition-all group cursor-pointer" onClick={() => selecionarInstituicao(inst)}>
                    
                    {editandoInstId === inst.id ? (
                      <div className="flex items-center gap-2 w-full pr-2" onClick={e => e.stopPropagation()}>
                        <input 
                          type="text" 
                          value={nomeInstEdicao} 
                          onChange={(e) => setNomeInstEdicao(e.target.value)} 
                          className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800" 
                          autoFocus 
                        />
                        <button onClick={(e) => handleSalvarEdicaoInst(e, inst.id)} className="bg-green-500 text-white p-1.5 rounded-lg hover:bg-green-600 shadow-sm"><Check size={16}/></button>
                        <button onClick={(e) => { e.stopPropagation(); setEditandoInstId(null); }} className="bg-gray-200 text-gray-600 p-1.5 rounded-lg hover:bg-gray-300"><X size={16}/></button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-left font-bold text-gray-700 group-hover:text-blue-700 truncate mr-2">
                          {inst.nome}
                        </span>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditandoInstId(inst.id); setNomeInstEdicao(inst.nome); }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar Nome"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={(e) => handleLixeiraInstituicao(e, inst.id, inst.nome)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Mover Instituição para Lixeira"
                          >
                            <Trash2 size={18} />
                          </button>
                          <div className="p-2 text-gray-400 group-hover:text-blue-600 bg-gray-50 rounded-lg ml-1">
                            <ArrowRight size={18} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // TELA 2: O DASHBOARD REAL (Centro de Comando)
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* CABEÇALHO REVISADO: O botão "Trocar" virou um Dropdown inteligente */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8 justify-between">
        <div className="flex items-center gap-3 w-full">
          <div className="bg-blue-100 text-blue-700 p-3 rounded-xl shadow-sm shrink-0">
            <GraduationCap size={28} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-gray-800 leading-tight">Centro de Comando</h1>
            
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-gray-500 text-sm font-medium">Instituição:</span>
              <select
                className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 py-1 px-2 font-bold cursor-pointer max-w-[200px] sm:max-w-xs truncate"
                value={escolaSelecionada.id}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'NOVA') {
                    setEscolaSelecionada(null);
                  } else {
                    const inst = instituicoes.find(i => i.id === val);
                    if (inst) setEscolaSelecionada(inst);
                  }
                }}
              >
                {instituicoes.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.nome}</option>
                ))}
                <option disabled>──────────</option>
                <option value="NOVA">+ Criar Nova Instituição</option>
              </select>
            </div>

          </div>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link to="/turmas" className="bg-blue-600 text-white p-4 rounded-2xl shadow-sm hover:shadow-md hover:bg-blue-700 transition-all flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/50 p-2 rounded-xl"><Building2 size={20}/></div>
              <span className="font-bold">Nova Turma</span>
            </div>
            <Plus size={20} className="opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all"/>
          </Link>

          <Link to="/alunos" className="bg-green-600 text-white p-4 rounded-2xl shadow-sm hover:shadow-md hover:bg-green-700 transition-all flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="bg-green-500/50 p-2 rounded-xl"><UserPlus size={20}/></div>
              <span className="font-bold">Adicionar Aluno</span>
            </div>
            <Plus size={20} className="opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all"/>
          </Link>

          <Link to="/tarefas" className="bg-orange-500 text-white p-4 rounded-2xl shadow-sm hover:shadow-md hover:bg-orange-600 transition-all flex items-center justify-between group text-left">
            <div className="flex items-center gap-3">
              <div className="bg-orange-400/50 p-2 rounded-xl"><FileText size={20}/></div>
              <span className="font-bold">Nova Tarefa</span>
            </div>
            <Plus size={20} className="opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all"/>
          </Link>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          Minhas Turmas Ativas 
          {!loadingDados && <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">{minhasTurmas.length}</span>}
        </h2>
        
        {loadingDados ? (
          <div className="text-gray-400 font-medium animate-pulse">Carregando suas turmas...</div>
        ) : minhasTurmas.length === 0 ? (
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-gray-500 font-medium mb-4">Você ainda não tem turmas nesta instituição.</p>
            <Link to="/turmas" className="text-blue-600 font-bold hover:underline">Criar minha primeira turma agora</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {minhasTurmas.map(turma => (
              <Link key={turma.id} to="/tarefas" state={{ turmaIdSelecionada: turma.id }} className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm hover:border-blue-400 hover:shadow-md transition-all group flex justify-between items-center">
                <div>
                  <h3 className="font-black text-gray-800 text-lg group-hover:text-blue-700 transition-colors">{turma.nome}</h3>
                  <p className="text-xs text-gray-400 mt-1 font-medium">Clique para gerenciar</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-full group-hover:bg-blue-50 transition-colors">
                  <ChevronRight className="text-gray-400 group-hover:text-blue-600" size={20}/>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 pt-8">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Visão Geral da Instituição</h2>
        <div className="flex gap-6">
          <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 flex-1 flex items-center justify-between">
            <span className="text-gray-500 text-sm font-bold flex items-center gap-2"><Users size={16}/> Alunos Ativos</span>
            <span className="font-black text-gray-800">{loadingDados ? '...' : estatisticas.alunos}</span>
          </div>
          <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 flex-1 flex items-center justify-between">
            <span className="text-gray-500 text-sm font-bold flex items-center gap-2"><LayoutDashboard size={16}/> Pendências</span>
            <span className="font-black text-gray-800">{loadingDados ? '...' : estatisticas.pendencias}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
