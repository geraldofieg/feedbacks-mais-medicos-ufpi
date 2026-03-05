import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Plus, ArrowRight, GraduationCap, Users, LayoutDashboard, Shuffle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, escolaSelecionada, setEscolaSelecionada } = useAuth();
  
  // Estados para o "Porteiro"
  const [instituicoes, setInstituicoes] = useState([]);
  const [novaInstituicao, setNovaInstituicao] = useState('');
  const [loading, setLoading] = useState(true);

  // Busca as instituições que o professor já tem (baseado nas turmas que ele criou no passado)
  useEffect(() => {
    async function fetchInstituicoes() {
      if (!currentUser) return;
      try {
        const q = query(
          collection(db, 'turmas'),
          where('professorUid', '==', currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        
        // Usamos um Set para garantir que os nomes não fiquem repetidos
        const instSet = new Set();
        querySnapshot.docs.forEach(doc => {
          if (doc.data().instituicao) {
            instSet.add(doc.data().instituicao);
          }
        });
        
        setInstituicoes(Array.from(instSet));
      } catch (error) {
        console.error("Erro ao buscar instituições:", error);
      } finally {
        setLoading(false);
      }
    }
    
    // Só busca se o cara ainda não selecionou a escola
    if (!escolaSelecionada) {
      fetchInstituicoes();
    }
  }, [currentUser, escolaSelecionada]);

  function handleCriarAcessar(e) {
    e.preventDefault();
    if (novaInstituicao.trim()) {
      setEscolaSelecionada(novaInstituicao.trim());
    }
  }

  function selecionarInstituicao(nome) {
    setEscolaSelecionada(nome);
  }

  // ==========================================
  // TELA 1: O PORTEIRO (Se não escolheu a instituição ainda)
  // ==========================================
  if (!escolaSelecionada) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-10">
            <div className="bg-blue-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Building2 size={32} />
            </div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tight">Bem-vindo(a), Professor(a)!</h1>
            <p className="text-gray-500 mt-3 text-lg">Para começarmos, selecione seu espaço de trabalho ou crie um novo.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            
            {/* BLOCO 1: Criar Novo Espaço */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-black text-gray-800 mb-2 flex items-center gap-2">
                <Plus className="text-blue-600"/> Criar Nova Instituição
              </h2>
              <p className="text-gray-500 text-sm mb-6 font-medium">Inicie um ambiente isolado para suas novas turmas.</p>
              
              <form onSubmit={handleCriarAcessar} className="space-y-4">
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Meu Cursinho, Mais Médicos, USP..."
                    className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors font-medium"
                    value={novaInstituicao}
                    onChange={(e) => setNovaInstituicao(e.target.value)}
                  />
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-black py-3.5 px-4 rounded-xl hover:bg-blue-700 transition-all shadow-md flex justify-center items-center gap-2">
                  Acessar Novo Espaço <ArrowRight size={18}/>
                </button>
              </form>
            </div>

            {/* BLOCO 2: Lista de Espaços Existentes */}
            <div className="bg-gray-50 p-8 rounded-2xl border border-gray-200">
              <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                <LayoutDashboard className="text-gray-500"/> Meus Espaços
              </h2>
              
              {loading ? (
                <div className="text-gray-500 text-sm font-medium animate-pulse">Procurando suas instituições...</div>
              ) : instituicoes.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm font-medium italic">Você ainda não possui instituições cadastradas.</p>
                  <p className="text-gray-400 text-xs mt-2">Crie a sua primeira no quadro ao lado!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                  {instituicoes.map(inst => (
                    <button
                      key={inst}
                      onClick={() => selecionarInstituicao(inst)}
                      className="w-full bg-white border border-gray-200 p-4 rounded-xl flex items-center justify-between hover:border-blue-500 hover:shadow-sm transition-all text-left group"
                    >
                      <span className="font-bold text-gray-700 group-hover:text-blue-700">{inst}</span>
                      <ArrowRight size={18} className="text-gray-400 group-hover:text-blue-600" />
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
  // TELA 2: O DASHBOARD REAL (Se já escolheu a instituição)
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* CABEÇALHO DO DASHBOARD */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8 justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 text-blue-700 p-3 rounded-xl shadow-sm">
            <GraduationCap size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 leading-tight">Painel de Controle</h1>
            <p className="text-gray-500 text-sm font-medium mt-0.5">
              Você está na instituição: <strong className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{escolaSelecionada}</strong>
            </p>
          </div>
        </div>
        
        {/* BOTÃO PARA TROCAR DE INSTITUIÇÃO */}
        <button 
          onClick={() => setEscolaSelecionada('')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all font-bold"
        >
          <Shuffle size={16}/> Trocar Espaço
        </button>
      </div>

      {/* CARDS DE RESUMO RÁPIDO */}
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

      {/* CALL TO ACTION PARA CRIAR TURMA */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-8 text-center shadow-sm">
        <h2 className="text-xl font-black text-blue-900 mb-2">Sua instituição está configurada!</h2>
        <p className="text-blue-700 mb-6 max-w-lg mx-auto font-medium">
          Para começar a gerenciar suas avaliações, o primeiro passo é criar uma turma para agrupar seus alunos.
        </p>
        <Link to="/turmas" className="inline-flex items-center gap-2 bg-blue-600 text-white font-black py-3.5 px-6 rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
          <Plus size={20}/> Acessar Minhas Turmas
        </Link>
      </div>

    </div>
  );
}
