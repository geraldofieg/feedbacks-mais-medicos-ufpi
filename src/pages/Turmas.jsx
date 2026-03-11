import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Users, Plus, ArrowRight, Pencil, Trash2, X, Check, FileText, School } from 'lucide-react';
import { Link } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';

export default function Turmas() {
  // AJUSTE: Trazendo o setEscolaSelecionada para atualizar o crachá assim que criar
  const { currentUser, userProfile, escolaSelecionada, setEscolaSelecionada } = useAuth();
  
  const [turmas, setTurmas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [novaTurma, setNovaTurma] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState('');

  // ESTADOS DO ONBOARDING (Criação de Instituição)
  const [precisaCriarEscola, setPrecisaCriarEscola] = useState(false);
  const [novaEscolaNome, setNovaEscolaNome] = useState('');
  const [salvandoEscola, setSalvandoEscola] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  // 1. VERIFICA SE O PROFESSOR TEM INSTITUIÇÃO (Se não tiver, ativa a tela de Onboarding)
  useEffect(() => {
    async function checkInstituicao() {
      if (!currentUser) return;
      try {
        const instRef = collection(db, 'instituicoes');
        const q = isAdmin ? instRef : query(instRef, where('professorUid', '==', currentUser.uid));
        const snap = await getDocs(q);
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.status !== 'lixeira');

        if (lista.length === 0) {
          setPrecisaCriarEscola(true);
          setLoading(false);
          return;
        }

        // Se tem instituição mas a memória perdeu, auto-seleciona a primeira
        if (!escolaSelecionada) {
          setEscolaSelecionada(lista[0]);
        }
      } catch (e) {
        console.error("Erro ao verificar instituição:", e);
      }
    }
    checkInstituicao();
  }, [currentUser, isAdmin, escolaSelecionada, setEscolaSelecionada]);

  // 2. BUSCA TURMAS (Só roda se ele já tiver instituição selecionada)
  useEffect(() => {
    async function fetchTurmas() {
      if (!currentUser || !escolaSelecionada?.id || precisaCriarEscola) return;
      
      try {
        const turmasRef = collection(db, 'turmas');
        const q = isAdmin
          ? query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id))
          : query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));

        const querySnapshot = await getDocs(q);
        const turmasData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const turmasAtivas = turmasData.filter(t => t.status !== 'lixeira');
        setTurmas(turmasAtivas.sort((a, b) => (b.dataCriacao?.toMillis() || 0) - (a.dataCriacao?.toMillis() || 0)));
      } catch (error) {
        console.error("Erro ao buscar turmas:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTurmas();
  }, [currentUser, escolaSelecionada, isAdmin, precisaCriarEscola]);

  // =========================================================================
  // FUNÇÃO: CRIAR INSTITUIÇÃO (ONBOARDING)
  // =========================================================================
  async function handleCriarInstituicao(e) {
    e.preventDefault();
    if (!novaEscolaNome.trim()) return;
    try {
      setSalvandoEscola(true);
      const novaEscolaObj = {
        nome: novaEscolaNome.trim(),
        professorUid: currentUser.uid,
        status: 'ativa',
        dataCriacao: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'instituicoes'), novaEscolaObj);
      
      // Salva na memória e libera a tela de turmas
      setEscolaSelecionada({ id: docRef.id, ...novaEscolaObj });
      setPrecisaCriarEscola(false);
    } catch (error) {
      console.error("Erro ao criar instituição:", error);
      alert("Erro ao criar a instituição.");
    } finally {
      setSalvandoEscola(false);
    }
  }

  // =========================================================================
  // FUNÇÃO: CRIAR TURMA
  // =========================================================================
  async function handleCriarTurma(e) {
    e.preventDefault();
    if (!novaTurma.trim() || !escolaSelecionada?.id) return;

    try {
      setSalvando(true);
      const novaTurmaObj = {
        nome: novaTurma.trim(),
        instituicaoId: escolaSelecionada.id,
        instituicaoNome: escolaSelecionada.nome, 
        professorUid: currentUser.uid,
        status: 'ativa',
        dataCriacao: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'turmas'), novaTurmaObj);
      
      setTurmas([{ id: docRef.id, ...novaTurmaObj, dataCriacao: { toMillis: () => Date.now() } }, ...turmas]);
      setNovaTurma('');
    } catch (error) {
      console.error("Erro ao criar turma:", error);
      alert("Erro ao criar a turma.");
    } finally {
      setSalvando(false);
    }
  }

  // ... (Edição e Lixeira)
  async function handleSalvarEdicao(id) {
    if (!nomeEdicao.trim()) return;
    try {
      await updateDoc(doc(db, 'turmas', id), { nome: nomeEdicao.trim() });
      setTurmas(turmas.map(t => t.id === id ? { ...t, nome: nomeEdicao.trim() } : t));
      setEditandoId(null);
    } catch (error) { console.error("Erro ao editar turma:", error); }
  }

  async function handleLixeira(id, nome) {
    if (!window.confirm(`Tem certeza que deseja enviar a turma "${nome}" para a lixeira?\n\nAlunos e tarefas vinculados deixarão de aparecer nos relatórios principais.`)) return;
    try {
      await updateDoc(doc(db, 'turmas', id), { status: 'lixeira' });
      setTurmas(turmas.filter(t => t.id !== id));
    } catch (error) { console.error("Erro ao enviar para lixeira:", error); }
  }

  if (loading) return <div className="p-20 text-center text-gray-400 font-bold animate-pulse">Carregando painel...</div>;

  // =========================================================================
  // TELA 1: ONBOARDING (Se o professor não tiver Instituição criada)
  // =========================================================================
  if (precisaCriarEscola) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-blue-100 text-blue-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
          <School size={48} />
        </div>
        <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-4">Onde você ensina?</h1>
        <p className="text-gray-500 text-lg mb-10 max-w-lg mx-auto font-medium">
          Ex: UFPI, UFT, USP, ou "Consultoria Particular". Digite o nome do seu ambiente de ensino para começarmos.
        </p>

        <form onSubmit={handleCriarInstituicao} className="max-w-md mx-auto flex flex-col gap-4">
          <input
            type="text" required autoFocus placeholder="Nome da Instituição..."
            className="w-full px-5 py-4 bg-white border-2 border-gray-200 text-gray-800 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-bold outline-none text-lg transition-all text-center placeholder:font-medium"
            value={novaEscolaNome} onChange={(e) => setNovaEscolaNome(e.target.value)}
          />
          <button type="submit" disabled={salvandoEscola} className="w-full bg-blue-600 text-white font-black py-4 px-8 rounded-2xl shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all text-lg flex justify-center items-center gap-2">
            {salvandoEscola ? 'Criando Instituição...' : 'Salvar e Continuar'} <ArrowRight size={20}/>
          </button>
        </form>
      </div>
    );
  }

  // =========================================================================
  // TELA 2: VISÃO PADRÃO DE TURMAS
  // =========================================================================
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
      <Breadcrumb items={[{ label: 'Turmas' }]} />

      <div className="flex items-center gap-3 mb-8 mt-3">
        <div className="bg-blue-100 text-blue-700 p-3 rounded-xl shadow-sm">
          <BookOpen size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-800 leading-tight">Gestão de Turmas</h1>
          <p className="text-sm font-medium text-gray-500 mt-0.5">
            Agrupamentos em: <strong className="text-gray-700">{escolaSelecionada?.nome}</strong>
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* BLOCO 1: Lista de Turmas */}
        <div className="w-full lg:w-2/3 order-1">
          {turmas.length === 0 ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
              <BookOpen className="text-gray-300 w-16 h-16 mx-auto mb-4" />
              <h3 className="text-xl font-black text-gray-700 mb-2">Nenhuma turma criada</h3>
              <p className="text-gray-500 mb-6 text-sm">Utilize o formulário lateral para criar o seu primeiro agrupamento na instituição {escolaSelecionada?.nome}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {turmas.map(turma => (
                <div key={turma.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:border-blue-300 hover:shadow-md transition-all overflow-hidden flex flex-col group">
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <div className="bg-blue-50 text-blue-600 p-2 rounded-lg"><BookOpen size={20}/></div>
                      
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditandoId(turma.id); setNomeEdicao(turma.nome); }} 
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar Nome"
                        >
                          <Pencil size={18}/>
                        </button>
                        <button 
                          onClick={() => handleLixeira(turma.id, turma.nome)} 
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Mover para Lixeira"
                        >
                          <Trash2 size={18}/>
                        </button>
                      </div>
                    </div>
                    
                    {editandoId === turma.id ? (
                      <div className="flex items-center gap-2 mb-1 mt-2">
                        <input 
                          type="text" value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)} 
                          className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800" autoFocus 
                        />
                        <button onClick={() => handleSalvarEdicao(turma.id)} className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 shadow-sm"><Check size={16}/></button>
                        <button onClick={() => setEditandoId(null)} className="bg-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-300"><X size={16}/></button>
                      </div>
                    ) : (
                      <h3 className="font-black text-gray-800 text-xl mb-1 truncate">{turma.nome}</h3>
                    )}
                    <p className="text-xs text-gray-400 font-medium">Turma Ativa</p>
                  </div>
                  
                  <div className="bg-gray-50 border-t border-gray-100 p-3 grid grid-cols-2 gap-2">
                    <Link to="/alunos" state={{ turmaIdSelecionada: turma.id }} className="flex items-center justify-center gap-1.5 text-sm font-bold text-gray-600 hover:text-blue-600 hover:bg-blue-50 py-2 rounded-lg transition-colors">
                      <Users size={16}/> Alunos
                    </Link>
                    <Link to="/tarefas" state={{ turmaIdSelecionada: turma.id }} className="flex items-center justify-center gap-1.5 text-sm font-bold text-blue-600 hover:bg-blue-50 py-2 rounded-lg transition-colors">
                      <FileText size={16}/> Tarefas <ArrowRight size={14}/>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BLOCO 2: Formulário de Criação de Turma */}
        <div className="w-full lg:w-1/3 order-2">
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 sticky top-24">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Plus size={16}/> Nova Turma
            </h2>
            <form onSubmit={handleCriarTurma} className="flex flex-col gap-3">
              <input
                type="text" required placeholder="Ex: Odontologia 3º Período..."
                className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold outline-none placeholder:font-medium placeholder:text-gray-400"
                value={novaTurma} onChange={(e) => setNovaTurma(e.target.value)}
              />
              <button type="submit" disabled={salvando} className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm flex justify-center items-center gap-2">
                {salvando ? 'Criando...' : 'Criar Turma'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
