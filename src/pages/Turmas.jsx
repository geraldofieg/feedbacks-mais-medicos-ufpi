import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Users, Plus, ArrowRight, Pencil, Trash2, X, Check, FileText, School, Star, Copy, RefreshCw, Building2 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';

export default function Turmas() {
  const { currentUser, userProfile, escolaSelecionada, setEscolaSelecionada } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [turmas, setTurmas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // ESTADOS CRIAR DO ZERO
  const [novaTurma, setNovaTurma] = useState('');
  const [salvando, setSalvando] = useState(false);

  // ESTADOS DO CLONADOR DE TURMAS
  const [modoCriacao, setModoCriacao] = useState('nova'); // 'nova' ou 'clonar'
  const [turmasModelo, setTurmasModelo] = useState([]);
  const [modeloSelecionado, setModeloSelecionado] = useState('');
  const [nomeTurmaClonada, setNomeTurmaClonada] = useState('');
  const [clonando, setClonando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState('');

  // ESTADOS DO ONBOARDING / NOVA INSTITUIÇÃO
  const [precisaCriarEscola, setPrecisaCriarEscola] = useState(false);
  const [novaEscolaNome, setNovaEscolaNome] = useState('');
  const [salvandoEscola, setSalvandoEscola] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  // 1. VERIFICA INSTITUIÇÃO OU COMANDO DE ROTA
  useEffect(() => {
    async function checkInstituicao() {
      if (!currentUser) return;
      
      // NOVO: Escuta a "ordem" enviada pelo Dashboard para forçar a tela de criação
      if (location.state?.abrirModalInstituicao) {
         setPrecisaCriarEscola(true);
         setLoading(false);
         // Limpa o state para não ficar preso na tela de criação se atualizar a página
         window.history.replaceState({}, document.title) 
         return;
      }

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

        if (!escolaSelecionada) setEscolaSelecionada(lista[0]);
      } catch (e) {
        console.error("Erro ao verificar instituição:", e);
      }
    }
    checkInstituicao();
  }, [currentUser, isAdmin, escolaSelecionada, setEscolaSelecionada, location.state]);

  // 2. BUSCA TURMAS DO USUÁRIO E TURMAS MODELO DA INSTITUIÇÃO
  useEffect(() => {
    async function fetchTurmas() {
      if (!currentUser || !escolaSelecionada?.id || precisaCriarEscola) {
         if (!precisaCriarEscola) setLoading(false);
         return;
      }
      
      try {
        // Busca turmas do professor (ou todas se for admin)
        const turmasRef = collection(db, 'turmas');
        const q = isAdmin
          ? query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id))
          : query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));

        const querySnapshot = await getDocs(q);
        const turmasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const turmasAtivas = turmasData.filter(t => t.status !== 'lixeira');
        setTurmas(turmasAtivas.sort((a, b) => (b.dataCriacao?.toMillis() || 0) - (a.dataCriacao?.toMillis() || 0)));

        // Busca QUAISQUER turmas daquela instituição que o ADMIN marcou como Modelo (isModelo = true)
        const qModelos = query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id), where('isModelo', '==', true));
        const snapModelos = await getDocs(qModelos);
        setTurmasModelo(snapModelos.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira'));

      } catch (error) {
        console.error("Erro ao buscar turmas:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTurmas();
  }, [currentUser, escolaSelecionada, isAdmin, precisaCriarEscola]);

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
      setEscolaSelecionada({ id: docRef.id, ...novaEscolaObj });
      setPrecisaCriarEscola(false);
      setNovaEscolaNome(''); // Limpa o campo para a próxima
      navigate('/turmas'); // Garante que a rota fica limpa no topo
    } catch (error) { console.error("Erro criar inst:", error); } 
    finally { setSalvandoEscola(false); }
  }

  // Permite ao usuário cancelar a criação se ele clicou no atalho mas desistiu
  function cancelarCriacaoEscola() {
     setPrecisaCriarEscola(false);
     setNovaEscolaNome('');
     if (!escolaSelecionada) navigate('/'); // Se não tinha escola, volta pro Dashboard
  }

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
        isModelo: false, // Nasce comum
        dataCriacao: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'turmas'), novaTurmaObj);
      setTurmas([{ id: docRef.id, ...novaTurmaObj, dataCriacao: { toMillis: () => Date.now() } }, ...turmas]);
      setNovaTurma('');
    } catch (error) { console.error("Erro ao criar turma:", error); } 
    finally { setSalvando(false); }
  }

  // =========================================================================
  // MOTOR DE CLONAGEM MÁGICA
  // =========================================================================
  async function handleClonarTurma(e) {
    e.preventDefault();
    if (!modeloSelecionado || !nomeTurmaClonada.trim() || !escolaSelecionada?.id) return;

    try {
      setClonando(true);
      
      // 1. Cria a nova Turma para o professor logado
      const novaTurmaObj = {
        nome: nomeTurmaClonada.trim(),
        instituicaoId: escolaSelecionada.id,
        instituicaoNome: escolaSelecionada.nome, 
        professorUid: currentUser.uid,
        status: 'ativa',
        isModelo: false, // A cópia NÃO é um modelo
        dataCriacao: serverTimestamp()
      };
      const turmaDocRef = await addDoc(collection(db, 'turmas'), novaTurmaObj);

      // 2. Busca todas as tarefas da turma Modelo
      const qTarefas = query(collection(db, 'tarefas'), where('turmaId', '==', modeloSelecionado));
      const snapTarefas = await getDocs(qTarefas);
      
      let tarefasCopiadas = 0;

      // 3. Clona cada tarefa, trocando apenas o ID da Turma e o ID do Professor
      for (const docT of snapTarefas.docs) {
        const tarefaOriginal = docT.data();
        if (tarefaOriginal.status !== 'lixeira') {
          await addDoc(collection(db, 'tarefas'), {
            ...tarefaOriginal,
            turmaId: turmaDocRef.id,
            professorUid: currentUser.uid,
            dataCriacao: serverTimestamp() // Atualiza a data de criação no banco
          });
          tarefasCopiadas++;
        }
      }

      // 4. Atualiza a tela
      setTurmas([{ id: turmaDocRef.id, ...novaTurmaObj, dataCriacao: { toMillis: () => Date.now() } }, ...turmas]);
      setModeloSelecionado('');
      setNomeTurmaClonada('');
      setModoCriacao('nova');
      
      alert(`✅ Sucesso! Turma criada e ${tarefasCopiadas} tarefas foram importadas perfeitamente.`);

    } catch (error) {
      console.error("Erro ao clonar turma:", error);
      alert("Erro ao importar dados do modelo.");
    } finally {
      setClonando(false);
    }
  }

  // FUNÇÃO ADMIN: MARCAR/DESMARCAR TURMA COMO MODELO OFICIAL
  async function toggleTurmaModelo(turmaId, statusAtual) {
    if (!isAdmin) return;
    try {
      const novoStatus = !statusAtual;
      await updateDoc(doc(db, 'turmas', turmaId), { isModelo: novoStatus });
      setTurmas(turmas.map(t => t.id === turmaId ? { ...t, isModelo: novoStatus } : t));
      
      // Atualiza a lista de modelos do dropdown
      if (novoStatus) {
        const turmaAtualizada = turmas.find(t => t.id === turmaId);
        setTurmasModelo([...turmasModelo, { ...turmaAtualizada, isModelo: true }]);
      } else {
        setTurmasModelo(turmasModelo.filter(t => t.id !== turmaId));
      }
    } catch (e) { console.error("Erro ao alterar status de modelo:", e); }
  }

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
  // TELA 1: ONBOARDING / NOVA INSTITUIÇÃO (ATALHO)
  // =========================================================================
  if (precisaCriarEscola) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center animate-in zoom-in-95 duration-500">
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
            className="w-full px-5 py-4 bg-white border-2 border-gray-200 text-gray-800 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-bold outline-none text-lg transition-all text-center placeholder:font-medium shadow-sm"
            value={novaEscolaNome} onChange={(e) => setNovaEscolaNome(e.target.value)}
          />
          <button type="submit" disabled={salvandoEscola} className="w-full bg-blue-600 text-white font-black py-4 px-8 rounded-2xl shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all text-lg flex justify-center items-center gap-2">
            {salvandoEscola ? 'Criando Instituição...' : 'Salvar e Continuar'} <ArrowRight size={20}/>
          </button>
          
          {/* NOVO: Botão de Cancelar (Caso tenha entrado por engano via atalho) */}
          {escolaSelecionada && (
            <button type="button" onClick={cancelarCriacaoEscola} className="mt-2 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors">
               Cancelar e voltar
            </button>
          )}
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 mt-3 border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
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
        
        {/* NOVO: ATALHO PARA NOVA INSTITUIÇÃO NO TOPO DA TELA */}
        <button 
          onClick={() => setPrecisaCriarEscola(true)}
          className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm"
        >
          <Building2 size={16} /> Nova Instituição
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* BLOCO 1: Lista de Turmas */}
        <div className="w-full lg:w-2/3 order-1">
          {turmas.length === 0 ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
              <BookOpen className="text-gray-300 w-16 h-16 mx-auto mb-4" />
              <h3 className="text-xl font-black text-gray-700 mb-2">Nenhuma turma criada</h3>
              <p className="text-gray-500 mb-6 text-sm">Utilize o painel lateral para criar ou importar o seu primeiro agrupamento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {turmas.map(turma => (
                <div key={turma.id} className={`bg-white border rounded-2xl shadow-sm transition-all overflow-hidden flex flex-col group ${turma.isModelo ? 'border-yellow-300 shadow-yellow-500/10' : 'border-gray-200 hover:border-blue-300'}`}>
                  <div className="p-5 flex-1 relative">
                    
                    {/* Estrela de Admin - Define Turma como Modelo Master */}
                    {isAdmin && (
                      <button 
                        onClick={() => toggleTurmaModelo(turma.id, turma.isModelo)}
                        className={`absolute top-4 right-4 p-2 rounded-full transition-all shadow-sm ${turma.isModelo ? 'bg-yellow-100 text-yellow-500 hover:bg-yellow-200' : 'bg-gray-50 text-gray-300 hover:bg-gray-100 hover:text-gray-500'}`}
                        title={turma.isModelo ? 'Desmarcar como Turma Modelo' : 'Definir como Turma Modelo (Padrão)'}
                      >
                        <Star size={18} fill={turma.isModelo ? "currentColor" : "none"} />
                      </button>
                    )}

                    <div className="flex justify-between items-start mb-3 pr-10">
                      <div className={`p-2 rounded-lg ${turma.isModelo ? 'bg-yellow-50 text-yellow-600' : 'bg-blue-50 text-blue-600'}`}>
                        <BookOpen size={20}/>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditandoId(turma.id); setNomeEdicao(turma.nome); }} 
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar Nome"
                        ><Pencil size={18}/></button>
                        <button 
                          onClick={() => handleLixeira(turma.id, turma.nome)} 
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Lixeira"
                        ><Trash2 size={18}/></button>
                      </div>
                    </div>
                    
                    {editandoId === turma.id ? (
                      <div className="flex items-center gap-2 mb-1 mt-2">
                        <input 
                          type="text" value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)} 
                          className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800" autoFocus 
                        />
                        <button onClick={() => handleSalvarEdicao(turma.id)} className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600"><Check size={16}/></button>
                        <button onClick={() => setEditandoId(null)} className="bg-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-300"><X size={16}/></button>
                      </div>
                    ) : (
                      <h3 className="font-black text-gray-800 text-xl mb-1 truncate">{turma.nome}</h3>
                    )}
                    
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-400 font-medium">Turma Ativa</p>
                      {turma.isModelo && <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Master</span>}
                    </div>
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

        {/* BLOCO 2: Painel de Criação / Clonagem */}
        <div className="w-full lg:w-1/3 order-2">
          <div className="bg-white p-2 rounded-3xl border border-gray-200 shadow-sm sticky top-24">
            
            {/* ABAS DO PAINEL */}
            <div className="flex bg-gray-50 p-1 rounded-2xl mb-4">
              <button 
                onClick={() => setModoCriacao('nova')} 
                className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${modoCriacao === 'nova' ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Plus size={16}/> Criar do Zero
              </button>
              <button 
                onClick={() => setModoCriacao('clonar')} 
                className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${modoCriacao === 'clonar' ? 'bg-white text-purple-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Copy size={16}/> Importar Modelo
              </button>
            </div>

            {/* MODO 1: CRIAR DO ZERO */}
            {modoCriacao === 'nova' && (
              <div className="p-4 animate-in fade-in duration-300">
                <form onSubmit={handleCriarTurma} className="flex flex-col gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nome da nova turma</label>
                    <input
                      type="text" required placeholder="Ex: Odontologia 3º Período..."
                      className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-bold outline-none placeholder:font-medium placeholder:text-gray-400 transition-all"
                      value={novaTurma} onChange={(e) => setNovaTurma(e.target.value)}
                    />
                  </div>
                  <button type="submit" disabled={salvando} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm flex justify-center items-center gap-2">
                    {salvando ? <RefreshCw className="animate-spin" size={20}/> : <Plus size={20}/>}
                    {salvando ? 'Criando...' : 'Criar Turma em Branco'}
                  </button>
                </form>
              </div>
            )}

            {/* MODO 2: CLONAR MODELO */}
            {modoCriacao === 'clonar' && (
              <div className="p-4 animate-in fade-in duration-300">
                {turmasModelo.length === 0 ? (
                  <div className="text-center py-6 px-2 bg-purple-50 rounded-xl border border-purple-100">
                    <Star className="mx-auto text-purple-300 mb-2" size={32}/>
                    <p className="text-sm font-bold text-purple-800 leading-tight">A coordenação ainda não definiu turmas-modelo para {escolaSelecionada?.nome}.</p>
                  </div>
                ) : (
                  <form onSubmit={handleClonarTurma} className="flex flex-col gap-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Selecione o Modelo (Pacote)</label>
                      <select 
                        required 
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 font-bold outline-none cursor-pointer"
                        value={modeloSelecionado} onChange={e => setModeloSelecionado(e.target.value)}
                      >
                        <option value="">Escolha um curso...</option>
                        {turmasModelo.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nome da sua Turma</label>
                      <input
                        type="text" required placeholder="Ex: Mais Médicos - Polo Teresina"
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 font-bold outline-none placeholder:font-medium placeholder:text-gray-400 transition-all"
                        value={nomeTurmaClonada} onChange={(e) => setNomeTurmaClonada(e.target.value)}
                      />
                    </div>

                    <button type="submit" disabled={clonando || !modeloSelecionado} className="w-full bg-purple-600 text-white font-black py-4 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-all shadow-sm flex justify-center items-center gap-2 mt-2">
                      {clonando ? <RefreshCw className="animate-spin" size={20}/> : <Copy size={20}/>}
                      {clonando ? 'Importando tarefas...' : 'Clonar e Iniciar Curso'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
