import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ArrowRight, GraduationCap, Users, LayoutDashboard, Shuffle, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, escolaSelecionada, setEscolaSelecionada } = useAuth();
  
  const [instituicoes, setInstituicoes] = useState([]);
  const [novaInstituicao, setNovaInstituicao] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [escolaSelecionada]);

  // A CORREÇÃO DO BUG LÓGICO: Agora ele busca no banco oficial de Instituições
  useEffect(() => {
    async function fetchInstituicoes() {
      if (!currentUser) return;
      try {
        const instSet = new Set();

        // 1. Busca as instituições salvas oficialmente
        const qInst = query(collection(db, 'instituicoes'), where('professorUid', '==', currentUser.uid));
        const snapInst = await getDocs(qInst);
        snapInst.docs.forEach(d => instSet.add(d.data().nome));

        // 2. Busca pelas turmas antigas (para garantir que nada do passado se perca)
        const qTurmas = query(collection(db, 'turmas'), where('professorUid', '==', currentUser.uid));
        const snapTurmas = await getDocs(qTurmas);
        snapTurmas.docs.forEach(d => {
          if (d.data().instituicao) instSet.add(d.data().instituicao);
        });
        
        setInstituicoes(Array.from(instSet).sort());
      } catch (error) {
        console.error("Erro ao buscar instituições:", error);
      } finally {
        setLoading(false);
      }
    }
    
    if (!escolaSelecionada) {
      fetchInstituicoes();
    }
  }, [currentUser, escolaSelecionada]);

  // A CORREÇÃO DO SALVAMENTO: Salva no banco antes de entrar
  async function handleCriarAcessar(e) {
    e.preventDefault();
    const nomeInst = novaInstituicao.trim();
    if (!nomeInst) return;

    try {
      setSalvando(true);
      
      // Cria um ID seguro (ID_DO_PROFESSOR + Nome_da_Escola)
      const idSeguro = `${currentUser.uid}_${nomeInst.replace(/\s+/g, '')}`;
      
      // Salva a Instituição no Firebase para ela nunca mais sumir
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
      // A CORREÇÃO DE LAYOUT: Removido min-h-screen, adicionado padding robusto
      <div className="w-full flex flex-col items-center justify-start px-4 pt-12 pb-16 overflow-x-hidden">
        <div className="max-w-4xl w-full">
          
          <div className="text-center mb-8">
            <div className="bg-blue-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <GraduationCap size={32} /> 
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight">Bem-vindo(a)!</h1>
            <p className="text-gray-500 mt-2 text-base md:text-lg px-2">
              Para começar a usar a plataforma, você precisa criar ou selecionar uma <strong>Instituição</strong>.
            </p>
          </div>

          {/* A CORREÇÃO DO EMPILHAMENTO: Flex-col força um embaixo do outro no celular */}
          <div className="flex flex-col md:flex-row gap-6 w-full">
            
            <div className="w-full md:w-1/2 bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-black text-gray-800 mb-2 flex items-center gap-2">
                <Plus className="text-blue-600"/> Criar Instituição
              </h2>
              <p className="text-gray-500 text-sm mb-6 font-medium">Cadastre a faculdade, curso ou escola onde você leciona.</p>
              
              <form onSubmit={handleCriarAcessar} className="space-y-4">
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Meu Cursinho, Mais Médicos..."
                    className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors font-medium"
                    value={novaInstituicao}
                    onChange={(e) => setNovaInstituicao(e.target.value)}
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
              
              {loading ? (
                <div className="text-gray-500 text-sm font-medium animate-pulse">Buscando cadastros...</div>
              ) : instituicoes.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm font-medium italic">Você ainda não possui nenhuma instituição cadastrada.</p>
                  <p className="text-gray-400 text-xs mt-2">Crie a primeira utilizando o formulário!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                  {instituicoes.map(inst => (
                    <button
                      key={inst}
                      onClick={() => selecionarInstituicao(inst)}
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
      </div>
    );
  }

  // ==========================================
  // TELA 2: O DASHBOARD REAL
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8 justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 text-blue-700 p-3 rounded-xl shadow-sm">
            <GraduationCap size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 leading-tight">Painel de Controle</h1>
            <p className="text-gray-500 text-sm font-medium mt-0.5">
              Instituição: <strong className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{escolaSelecionada}</strong>
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

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 sm:p-8 text-center shadow-sm mb-8">
        <h2 className="text-xl font-black text-blue-900 mb-2">Sua instituição está configurada!</h2>
        <p className="text-blue-700 mb-6 max-w-lg mx-auto font-medium text-sm sm:text-base">
          Para começar a gerenciar suas avaliações, o primeiro passo é criar uma turma para agrupar seus alunos.
        </p>
        <Link to="/turmas" className="inline-flex w-full sm:w-auto justify-center items-center gap-2 bg-blue-600 text-white font-black py-3.5 px-6 rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
          <Plus size={20}/> Acessar Minhas Turmas
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total de Turmas</p>
            <div className="bg-blue-50 p-2.5 rounded-lg text-blue-600"><Building2 size={20}/></div>
          </div>
          <h3 className="text-3xl font-black text-gray-800">--</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Alunos Ativos</p>
            <div className="bg-green-50 p-2.5 rounded-lg text-green-600"><Users size={20}/></div>
          </div>
          <h3 className="text-3xl font-black text-gray-800">--</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Tarefas Pendentes</p>
            <div className="bg-orange-50 p-2.5 rounded-lg text-orange-600"><LayoutDashboard size={20}/></div>
          </div>
          <h3 className="text-3xl font-black text-gray-800">--</h3>
        </div>
      </div>
    </div>
  );
}
