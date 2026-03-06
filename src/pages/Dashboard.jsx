import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ArrowRight, GraduationCap, Users, LayoutDashboard, Shuffle, Building2, UserPlus, FileText, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, escolaSelecionada, setEscolaSelecionada } = useAuth();
  
  const [instituicoes, setInstituicoes] = useState([]);
  const [novaInstituicao, setNovaInstituicao] = useState('');
  const [loadingInst, setLoadingInst] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Novos estados para armazenar as turmas reais do professor
  const [minhasTurmas, setMinhasTurmas] = useState([]);
  const [estatisticas, setEstatisticas] = useState({ alunos: 0, pendencias: 0 });
  const [loadingDados, setLoadingDados] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }, [escolaSelecionada]);

  // Busca Instituições (O Porteiro)
  useEffect(() => {
    async function fetchInstituicoes() {
      if (!currentUser) return;
      try {
        const instSet = new Set();
        const qInst = query(collection(db, 'instituicoes'), where('professorUid', '==', currentUser.uid));
        const snapInst = await getDocs(qInst);
        snapInst.docs.forEach(d => instSet.add(d.data().nome));

        const qTurmas = query(collection(db, 'turmas'), where('professorUid', '==', currentUser.uid));
        const snapTurmas = await getDocs(qTurmas);
        snapTurmas.docs.forEach(d => {
          if (d.data().instituicao) instSet.add(d.data().instituicao);
        });
        
        setInstituicoes(Array.from(instSet).sort());
      } catch (error) {
        console.error("Erro ao buscar instituições:", error);
      } finally {
        setLoadingInst(false);
      }
    }
    
    if (!escolaSelecionada) {
      fetchInstituicoes();
    }
  }, [currentUser, escolaSelecionada]);

  // Busca Dados Reais do Dashboard (Turmas e Estatísticas)
  useEffect(() => {
    async function fetchDadosDashboard() {
      if (!currentUser || !escolaSelecionada) return;
      setLoadingDados(true);
      try {
        // 1. Busca as Turmas reais para exibir na tela
        const qTurmas = query(collection(db, 'turmas'), where('instituicao', '==', escolaSelecionada), where('professorUid', '==', currentUser.uid));
        const snapTurmas = await getDocs(qTurmas);
        
        const turmasData = snapTurmas.docs.map(t => ({ id: t.id, ...t.data() }));
        setMinhasTurmas(turmasData);

        // 2. Calcula as estatísticas
        let totalAlunos = 0;
        if (turmasData.length > 0) {
          const turmasIds = turmasData.map(d => d.id);
          const qAlunos = query(collection(db, 'alunos'), where('instituicao', '==', escolaSelecionada));
          const snapAlunos = await getDocs(qAlunos);
          totalAlunos = snapAlunos.docs.filter(a => turmasIds.includes(a.data().turmaId)).length;
        }

        setEstatisticas({
          alunos: totalAlunos,
          pendencias: 0 
        });
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

  async function handleCriarAcessar(e) {
    e.preventDefault();
    const nomeInst = novaInstituicao.trim();
    if (!nomeInst) return;

    try {
      setSalvando(true);
      const idSeguro = `${currentUser.uid}_${nomeInst.replace(/\s+/g, '')}`;
      
      await setDoc(doc(db, 'instituicoes', idSeguro), {
        nome: nomeInst,
        professorUid: currentUser.uid,
        dataCriacao: serverTimestamp()
      }, { merge: true });

      setEscolaSelecionada(nomeInst);
    } catch (error) {
      console.error("Erro ao salvar instituição:", error);
      alert("Ocorreu um erro. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function selecionarInstituicao(nome) {
    setEscolaSelecionada(nome);
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
                <p className="text-gray-500 text-sm font-medium italic">Você ainda não possui nenhuma instituição cadastrada.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                {instituicoes.map(inst => (
                  <button
                    key={inst} onClick={() => selecionarInstituicao(inst)}
                    className="w-full bg-white border border-gray-200 p-4 rounded-xl flex items-center justify-between hover:border-blue-500 hover:shadow-sm transition-all text-left group"
                  >
                    <span className="font-bold text-gray-700 group-hover:text-blue-700 truncate mr-2">{inst}</span>
                    <ArrowRight size={18} className="text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                  </button>
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
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8 justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 text-blue-700 p-3 rounded-xl shadow-sm">
            <GraduationCap size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 leading-tight">Centro de Comando</h1>
            <p className="text-gray-500 text-sm font-medium mt-0.5">
              Instituição Ativa: <strong className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{escolaSelecionada}</strong>
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => setEscolaSelecionada('')}
          className="flex w-full sm:w-auto items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all font-bold"
        >
          <Shuffle size={16}/> Trocar Instituição
        </button>
      </div>

      {/* BLOCO 1: AÇÕES RÁPIDAS (O que o professor quer fazer?) */}
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

      {/* BLOCO 2: CONTEÚDO REAL (As turmas do professor) */}
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

      {/* BLOCO 3: RAIO-X INFORMATIVO (Os números foram reduzidos para o rodapé) */}
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
