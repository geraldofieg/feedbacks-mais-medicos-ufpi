import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, Search, Pencil, Trash2, Check, X, GraduationCap, Phone, Mail, FileSpreadsheet, RefreshCw } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Alunos() {
  const { currentUser, userProfile, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [turmas, setTurmas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  const [filtroTurma, setFiltroTurma] = useState(() => {
    return location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || 'todas';
  });

  const [novoAluno, setNovoAluno] = useState({ nome: '', whatsapp: '', email: '', turmaId: '' });
  const [salvando, setSalvando] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); 
  
  // ESTADOS DO EFEITO UAU (Vapt-Vupt)
  const [sucessoMsg, setSucessoMsg] = useState('');
  const nomeInputRef = useRef(null);

  // ESTADOS DO IMPORTADOR EM LOTE
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [textoExcel, setTextoExcel] = useState('');
  const [turmaImportacao, setTurmaImportacao] = useState('');
  const [statusImportacao, setStatusImportacao] = useState('ocioso'); // ocioso, processando, concluido
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });

  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [whatsappEdicao, setWhatsappEdicao] = useState('');
  const [emailEdicao, setEmailEdicao] = useState('');
  const [turmaIdEdicao, setTurmaIdEdicao] = useState('');

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  useEffect(() => {
    if (location.state?.turmaIdSelecionada && location.state.turmaIdSelecionada !== filtroTurma) {
      setFiltroTurma(location.state.turmaIdSelecionada);
    }
  }, [location.state, filtroTurma]);

  useEffect(() => {
    if (filtroTurma && filtroTurma !== 'todas') {
      localStorage.setItem('ultimaTurmaAtiva', filtroTurma);
      setNovoAluno(prev => ({ ...prev, turmaId: filtroTurma }));
      setTurmaImportacao(filtroTurma); // Sincroniza o modal de importação também
    }
  }, [filtroTurma]);

  useEffect(() => {
    async function fetchData() {
      if (!currentUser || !escolaSelecionada?.id) return;
      setLoading(true);
      try {
        const turmasRef = collection(db, 'turmas');
        const qTurmas = isAdmin 
          ? query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id))
          : query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
        
        const snapTurmas = await getDocs(qTurmas);
        const turmasData = snapTurmas.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTurmas(turmasData);
        
        const targetTurma = location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || filtroTurma;
        const isValid = turmasData.some(t => t.id === targetTurma);
        
        if (isValid) {
          if (targetTurma !== filtroTurma) setFiltroTurma(targetTurma);
          setNovoAluno(prev => ({ ...prev, turmaId: targetTurma }));
          setTurmaImportacao(targetTurma);
        } else if (turmasData.length > 0) {
          setNovoAluno(prev => ({ ...prev, turmaId: turmasData[0].id }));
          setTurmaImportacao(turmasData[0].id);
        }

        const qAlunos = query(collection(db, 'alunos'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapAlunos = await getDocs(qAlunos);
        const alunosData = snapAlunos.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status !== 'lixeira');
        
        setAlunos(alunosData.sort((a, b) => a.nome.localeCompare(b.nome)));
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentUser, isAdmin, escolaSelecionada, filtroTurma, location.state]);

  async function handleCriar(e) {
    e.preventDefault();
    if (!novoAluno.nome.trim() || !novoAluno.turmaId) return;

    const nomeSalvo = novoAluno.nome.trim(); 

    try {
      setSalvando(true);
      const alunoData = {
        nome: nomeSalvo,
        whatsapp: novoAluno.whatsapp.trim(),
        email: novoAluno.email.trim(),
        turmaId: novoAluno.turmaId,
        instituicaoId: escolaSelecionada.id,
        professorUid: currentUser.uid,
        status: 'ativo',
        dataCadastro: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'alunos'), alunoData);
      
      const novaLista = [{ id: docRef.id, ...alunoData }, ...alunos];
      setAlunos(novaLista.sort((a, b) => a.nome.localeCompare(b.nome)));
      
      setNovoAluno(prev => ({ ...prev, nome: '', whatsapp: '', email: '' }));
      setSucessoMsg(`${nomeSalvo} matriculado(a) com sucesso!`);
      
      setTimeout(() => { setSucessoMsg(''); }, 3000);
      setTimeout(() => { if (nomeInputRef.current) nomeInputRef.current.focus(); }, 100);

    } catch (error) {
      console.error("Erro ao criar aluno:", error);
    } finally {
      setSalvando(false);
    }
  }

  // LOGICA DO IMPORTADOR EM LOTE
  async function handleImportacao(e) {
    e.preventDefault();
    if (!turmaImportacao) return alert("Selecione a turma de destino!");
    if (!textoExcel.trim()) return alert("Cole os nomes dos alunos!");

    const nomesBrutos = textoExcel.split('\n');
    const nomesLimpos = nomesBrutos
      .map(n => n.trim().toUpperCase())
      .filter(n => n.length > 2); // ignora linhas em branco

    const nomesUnicos = [...new Set(nomesLimpos)];
    if (nomesUnicos.length === 0) return alert("Nenhum nome válido encontrado.");
    
    if (!window.confirm(`Foram encontrados ${nomesUnicos.length} nomes válidos. Confirmar importação?`)) return;

    setStatusImportacao('processando');
    setProgresso({ atual: 0, total: nomesUnicos.length });

    let inseridos = 0;
    const novosParaEstado = [];

    try {
      for (const nome of nomesUnicos) {
        // Verifica duplicidade dentro da própria turma no frontend
        const jaExiste = alunos.find(a => a.nome.toUpperCase() === nome && a.turmaId === turmaImportacao);

        if (!jaExiste) {
          const alunoData = {
            nome: nome,
            whatsapp: '',
            email: '',
            instituicaoId: escolaSelecionada.id,
            turmaId: turmaImportacao,
            professorUid: currentUser.uid,
            status: 'ativo',
            dataCadastro: serverTimestamp()
          };
          const docRef = await addDoc(collection(db, 'alunos'), alunoData);
          novosParaEstado.push({ id: docRef.id, ...alunoData });
          inseridos++;
        }
        setProgresso(prev => ({ ...prev, atual: prev.atual + 1 }));
      }

      if (novosParaEstado.length > 0) {
        const novaLista = [...novosParaEstado, ...alunos];
        setAlunos(novaLista.sort((a, b) => a.nome.localeCompare(b.nome)));
      }

      setStatusImportacao('concluido');
      setTextoExcel('');
      alert(`✅ Importação Concluída! ${inseridos} alunos cadastrados com sucesso (ignoradas as duplicatas).`);
      
      setTimeout(() => {
        setIsImportModalOpen(false);
        setStatusImportacao('ocioso');
      }, 500);

    } catch (error) {
      console.error("Erro na importação:", error);
      alert("Ocorreu um erro durante a importação.");
      setStatusImportacao('ocioso');
    }
  }

  async function handleSalvarEdicao(id) {
    if (!nomeEdicao.trim() || !turmaIdEdicao) return;
    try {
      await updateDoc(doc(db, 'alunos', id), { 
        nome: nomeEdicao.trim(),
        whatsapp: whatsappEdicao.trim(),
        email: emailEdicao.trim(),
        turmaId: turmaIdEdicao
      });
      
      const novaLista = alunos.map(a => a.id === id ? { 
        ...a, 
        nome: nomeEdicao.trim(), 
        whatsapp: whatsappEdicao.trim(),
        email: emailEdicao.trim(),
        turmaId: turmaIdEdicao
      } : a);
      
      setAlunos(novaLista.sort((a, b) => a.nome.localeCompare(b.nome)));
      setEditandoId(null);
    } catch (error) {
      console.error("Erro ao editar:", error);
    }
  }

  async function handleLixeira(id, nome) {
    if (!window.confirm(`Remover o aluno "${nome}"? (As notas dele serão mantidas no sistema, mas ele sumirá das listas).`)) return;
    try {
      await updateDoc(doc(db, 'alunos', id), { status: 'lixeira' });
      setAlunos(alunos.filter(a => a.id !== id));
    } catch (error) {
      console.error("Erro ao remover:", error);
    }
  }

  const alunosFiltrados = alunos.filter(a => {
    const bateNome = a.nome.toLowerCase().includes(busca.toLowerCase());
    const bateTurma = filtroTurma === 'todas' || a.turmaId === filtroTurma;
    return bateNome && bateTurma;
  });

  const getNomeTurma = (idTurma) => turmas.find(t => t.id === idTurma)?.nome || 'Turma não encontrada';
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
      <Breadcrumb items={[{ label: 'Turmas', path: '/turmas' }, { label: 'Alunos' }]} />
      
      {/* 🔥 MODO FANTASMA: BARRA DE PROGRESSO DO ONBOARDING (SÓ APARECE SE TIVER ZERO ALUNOS NO SISTEMA) */}
      {!loading && turmas.length > 0 && alunos.length === 0 && (
        <div className="bg-white border border-gray-200 p-8 md:p-10 rounded-3xl max-w-4xl mx-auto shadow-sm mt-6 mb-10 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between mb-8 relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-100 -z-10 rounded-full"></div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2/3 h-1 bg-blue-600 -z-10 rounded-full"></div>
            
            <div className="flex flex-col items-center gap-2 bg-white px-2"><div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md ring-4 ring-white"><Check size={16}/></div><span className="text-[10px] font-black uppercase text-blue-600 tracking-widest hidden sm:block">Instituição</span></div>
            <div className="flex flex-col items-center gap-2 bg-white px-2"><div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md ring-4 ring-white"><Check size={16}/></div><span className="text-[10px] font-black uppercase text-blue-600 tracking-widest hidden sm:block">Turma</span></div>
            <div className="flex flex-col items-center gap-2 bg-white px-2"><div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md ring-4 ring-white animate-pulse">3</div><span className="text-[10px] font-black uppercase text-blue-600 tracking-widest hidden sm:block">Alunos</span></div>
            <div className="flex flex-col items-center gap-2 bg-white px-2"><div className="w-8 h-8 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center font-black text-sm ring-4 ring-white">4</div><span className="text-[10px] font-black uppercase text-gray-400 tracking-widest hidden sm:block">Tarefas</span></div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-gray-800 mb-2">Quase lá! Turma configurada.</h2>
            <p className="text-gray-500 font-medium text-lg">O Passo 3 é preencher sua sala de aula. Utilize os botões abaixo para cadastrar alunos individualmente ou importar uma lista completa do Excel.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4 mb-8">
        <h1 className="text-2xl font-black text-gray-800 flex items-center gap-3 tracking-tight">
          <div className="bg-green-100 text-green-600 p-2.5 rounded-xl shadow-sm"><Users size={26} /></div>
          Gestão de Alunos
        </h1>
        {turmas.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => setIsImportModalOpen(true)} 
              className="bg-green-50 text-green-700 border border-green-200 font-bold px-5 py-3.5 rounded-xl hover:bg-green-100 transition-all flex items-center justify-center gap-2"
            >
              <FileSpreadsheet size={20}/> Importar Excel
            </button>
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="bg-blue-600 text-white font-black px-6 py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              <Plus size={20}/> Novo Aluno
            </button>
          </div>
        )}
      </div>

      {turmas.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
            <input 
              type="text" placeholder="Buscar aluno por nome..." 
              className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-gray-700 transition-all placeholder:font-medium"
              value={busca} onChange={e => setBusca(e.target.value)}
            />
          </div>
          <select 
            className="px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-gray-700 cursor-pointer min-w-[240px] transition-all"
            value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}
          >
            <option value="todas">Todas as Turmas</option>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-4">
        {turmas.length > 0 && (
          <div className="flex items-center justify-between px-1 mb-2">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Alunos Cadastrados</h2>
            <span className="bg-gray-100 text-gray-500 text-[11px] font-black px-3 py-1 rounded-full">{alunosFiltrados.length}</span>
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center animate-pulse font-black text-gray-300 text-lg">Carregando lista de alunos...</div>
        ) : turmas.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm mt-8">
            <div className="bg-blue-50 text-blue-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <GraduationCap size={40} />
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">Nenhuma turma criada</h3>
            <p className="text-gray-500 font-medium mb-8 text-lg">Você precisa criar uma sala de aula antes de matricular os alunos.</p>
            <Link to="/turmas" className="bg-blue-600 text-white font-black px-8 py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 inline-flex items-center gap-2">
              <Plus size={20}/> Criar Turma
            </Link>
          </div>
        ) : alunosFiltrados.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm">
            <div className="bg-green-50 text-green-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users size={40}/>
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">A turma está vazia!</h3>
            <p className="text-gray-500 font-medium mb-8 text-lg">Nenhum aluno encontrado. Que tal matricular o primeiro da lista?</p>
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white font-black px-8 py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 inline-flex items-center gap-2">
              <Plus size={20}/> Matricular Aluno
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {alunosFiltrados.map(aluno => (
              <div key={aluno.id} className={`bg-white p-5 rounded-2xl border transition-all group ${editandoId === aluno.id ? 'border-blue-400 shadow-md ring-2 ring-blue-50' : 'border-gray-200 shadow-sm hover:border-green-300 hover:shadow-md'}`}>
                
                {editandoId === aluno.id ? (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div>
                      <label className="text-[10px] font-black text-slate-700 uppercase mb-1 block">Nome</label>
                      <input className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 outline-none" value={nomeEdicao} onChange={e => setNomeEdicao(e.target.value)} autoFocus/>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-700 uppercase mb-1 block">WhatsApp</label>
                      <input className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 outline-none" value={whatsappEdicao} onChange={e => setWhatsappEdicao(e.target.value)}/>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-700 uppercase mb-1 block">E-mail</label>
                      <input type="email" className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 outline-none" value={emailEdicao} onChange={e => setEmailEdicao(e.target.value)}/>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-700 uppercase mb-1 block">Turma</label>
                      <select className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 outline-none bg-white cursor-pointer" value={turmaIdEdicao} onChange={e => setTurmaIdEdicao(e.target.value)}>
                        {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => handleSalvarEdicao(aluno.id)} className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-black flex items-center justify-center gap-1 shadow-sm hover:bg-green-700"><Check size={16}/> Salvar</button>
                      <button onClick={() => setEditandoId(null)} className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-lg text-sm font-black flex items-center justify-center gap-1 hover:bg-gray-200"><X size={16}/> Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-3">
                      <div className="bg-green-50 text-green-600 p-3 rounded-xl shrink-0"><Users size={22}/></div>
                      <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditandoId(aluno.id); setNomeEdicao(aluno.nome); setWhatsappEdicao(aluno.whatsapp || ''); setEmailEdicao(aluno.email || ''); setTurmaIdEdicao(aluno.turmaId); }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar"
                        ><Pencil size={18}/></button>
                        <button 
                          onClick={() => handleLixeira(aluno.id, aluno.nome)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Remover"
                        ><Trash2 size={18}/></button>
                      </div>
                    </div>

                    <h3 className="font-black text-gray-800 text-lg leading-tight truncate mb-4" title={aluno.nome}>{aluno.nome}</h3>
                    
                    <div className="space-y-2.5">
                      <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider truncate max-w-full">
                        <GraduationCap size={14} className="shrink-0"/> <span className="truncate">{getNomeTurma(aluno.turmaId)}</span>
                      </div>
                      
                      {aluno.whatsapp && (
                        <div className="flex items-center gap-2 text-slate-600 text-xs font-bold mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <Phone size={14} className="text-green-500 shrink-0"/> <span className="truncate">{aluno.whatsapp}</span>
                        </div>
                      )}

                      {aluno.email && (
                        <div className="flex items-center gap-2 text-slate-600 text-xs font-bold mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <Mail size={14} className="text-blue-500 shrink-0"/> <span className="truncate" title={aluno.email}>{aluno.email}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE MATRÍCULA ÚNICA (VAPT-VUPT) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-slate-50">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Plus className="text-blue-600"/> Matricular Aluno</h2>
              <button 
                onClick={() => { setIsModalOpen(false); setSucessoMsg(''); }} 
                className="text-gray-400 hover:text-gray-700 bg-white border border-gray-200 rounded-full p-2 shadow-sm transition-all hover:scale-105"
              >
                <X size={20}/>
              </button>
            </div>
            
            {sucessoMsg && (
              <div className="mx-6 mt-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2 fade-in duration-300">
                <Check size={20} className="shrink-0" />
                <span className="text-sm font-bold">{sucessoMsg}</span>
              </div>
            )}

            <form onSubmit={handleCriar} className="p-6 md:p-8 space-y-5">
              <div>
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 block">Turma de Destino</label>
                <select 
                  className="w-full px-4 py-3.5 bg-blue-50 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-black text-blue-700 transition-colors cursor-pointer"
                  value={novoAluno.turmaId} onChange={e => setNovoAluno({...novoAluno, turmaId: e.target.value})} required
                >
                  {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 block">Nome Completo</label>
                <input
                  ref={nomeInputRef} 
                  type="text" required autoFocus placeholder="Ex: Maria da Silva..."
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-bold text-slate-800 transition-all placeholder:font-medium placeholder:text-gray-400"
                  value={novoAluno.nome} onChange={e => setNovoAluno({...novoAluno, nome: e.target.value})}
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1"><Phone size={14}/> WhatsApp (Opcional)</label>
                <input
                  type="text" placeholder="Ex: 11999999999"
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white outline-none font-bold text-slate-800 transition-all placeholder:font-medium placeholder:text-gray-400"
                  value={novoAluno.whatsapp} onChange={e => setNovoAluno({...novoAluno, whatsapp: e.target.value})}
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1"><Mail size={14}/> E-mail (Opcional)</label>
                <input
                  type="email" placeholder="Ex: aluno@email.com"
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-bold text-slate-800 transition-all placeholder:font-medium placeholder:text-gray-400"
                  value={novoAluno.email} onChange={e => setNovoAluno({...novoAluno, email: e.target.value})}
                />
              </div>

              <button 
                disabled={salvando || !novoAluno.turmaId} 
                className={`w-full text-white font-black py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-4 disabled:opacity-50 text-lg ${
                  sucessoMsg 
                    ? 'bg-green-500 hover:bg-green-600 shadow-green-500/20 scale-105' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                }`}
              >
                <Check size={24}/> 
                {salvando ? 'Salvando...' : sucessoMsg ? 'Cadastrado com Sucesso!' : 'Matricular e Continuar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE IMPORTAÇÃO EM LOTE */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-slate-50">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><FileSpreadsheet className="text-green-600"/> Importação em Lote</h2>
              <button 
                onClick={() => { setIsImportModalOpen(false); setTextoExcel(''); }} 
                className="text-gray-400 hover:text-gray-700 bg-white border border-gray-200 rounded-full p-2 shadow-sm transition-all hover:scale-105"
                disabled={statusImportacao === 'processando'}
              >
                <X size={20}/>
              </button>
            </div>

            <div className="p-6 md:p-8">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-6">
                <p className="text-sm font-medium text-blue-800">
                  Copie a coluna com os <strong>nomes dos alunos</strong> do seu Excel ou Moodle e cole na caixa abaixo. O sistema vai limpar espaços e ignorar nomes já existentes nesta turma.
                </p>
              </div>

              <form onSubmit={handleImportacao} className="space-y-5">
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 block">Turma de Destino</label>
                  <select 
                    className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-700 transition-colors cursor-pointer"
                    value={turmaImportacao} onChange={e => setTurmaImportacao(e.target.value)} required
                    disabled={statusImportacao === 'processando'}
                  >
                    {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 block">Cole os nomes (Um por linha)</label>
                  <textarea 
                    required autoFocus
                    className="w-full h-48 px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white outline-none font-mono text-sm text-gray-800 transition-all resize-none placeholder:text-gray-400"
                    placeholder="Exemplo:&#10;ANA MARIA SILVA&#10;CARLOS ALBERTO SOUZA&#10;JOÃO PEDRO SANTOS"
                    value={textoExcel} onChange={e => setTextoExcel(e.target.value)}
                    disabled={statusImportacao === 'processando'}
                  ></textarea>
                </div>

                {statusImportacao === 'processando' ? (
                  <div className="bg-gray-100 rounded-xl p-4 text-center">
                    <RefreshCw className="animate-spin text-green-600 mx-auto mb-2" size={24}/>
                    <p className="text-sm font-bold text-gray-700">Salvando alunos... ({progresso.atual} de {progresso.total})</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-3 overflow-hidden">
                      <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(progresso.atual / Math.max(1, progresso.total)) * 100}%` }}></div>
                    </div>
                  </div>
                ) : (
                  <button 
                    disabled={!turmaImportacao || !textoExcel.trim()} 
                    className="w-full bg-green-600 text-white font-black py-4 rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 text-lg"
                  >
                    <Users size={24}/> Iniciar Importação
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
