import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc, updateDoc, query, onSnapshot, serverTimestamp, orderBy, where, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Plus, Trash2, Settings, Building2, Users, CheckCircle, BookOpen, Layers, Rocket, ArrowLeftCircle, HelpCircle } from 'lucide-react';

export default function Configuracoes() {
  const [instituicoes, setInstituicoes] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  
  const [turmaAtiva, setTurmaAtiva] = useState('');
  const [isCriandoTarefa, setIsCriandoTarefa] = useState(false);
  
  const [novaInstNome, setNovaInstNome] = useState('');
  const [novaTurmaNome, setNovaTurmaNome] = useState('');
  const [instSelecionadaParaTurma, setInstSelecionadaParaTurma] = useState('');
  
  // O SEGREDO DA UX: O Formulário Educativo
  const [novaTarefa, setNovaTarefa] = useState({ nome: '', enunciado: '' });
  const [tipoTarefa, setTipoTarefa] = useState('simples'); // 'simples' ou 'composta'
  const [subtarefasTemp, setSubtarefasTemp] = useState([]); // Guarda as subtarefas durante a criação
  const [inputSubTemp, setInputSubTemp] = useState('');
  
  // Controle de edição inline de subtarefas antigas
  const [subtarefaNomes, setSubtarefaNomes] = useState({}); 

  // Setup do Usuário Zerado
  const [setupInicial, setSetupInicial] = useState({ instNome: '', turmaNome: '' });

  const [salvando, setSalvando] = useState(false);
  
  const [msgInst, setMsgInst] = useState('');
  const [msgTurma, setMsgTurma] = useState('');
  const [msgTarefa, setMsgTarefa] = useState('');

  useEffect(() => {
    const unsubInst = onSnapshot(query(collection(db, 'saas_instituicoes'), orderBy('nome', 'asc')), (snap) => setInstituicoes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubTurmas = onSnapshot(query(collection(db, 'saas_turmas'), orderBy('nome', 'asc')), (snap) => setTurmas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => { unsubInst(); unsubTurmas(); };
  }, []);

  useEffect(() => {
    if (!turmaAtiva) { 
      setTarefas([]); setIsCriandoTarefa(false); return; 
    }
    const qTarefas = query(collection(db, 'saas_tarefas'), where('idTurma', '==', turmaAtiva));
    const unsub = onSnapshot(qTarefas, (snap) => {
      let dados = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      dados.sort((a, b) => ((a.dataCriacao?.seconds || 0) - (b.dataCriacao?.seconds || 0)));
      setTarefas(dados);
    });
    return () => unsub();
  }, [turmaAtiva]);

  const mostrarMsg = (setter, texto) => { setter(texto); setTimeout(() => setter(''), 5000); };

  // --- AÇÕES: ONBOARDING INTELIGENTE ---
  async function handleCriarSetupInicial(e) {
    e.preventDefault(); if (salvando || !setupInicial.instNome.trim() || !setupInicial.turmaNome.trim()) return; setSalvando(true);
    try {
      const instRef = await addDoc(collection(db, 'saas_instituicoes'), { nome: setupInicial.instNome.trim(), dataCriacao: serverTimestamp() });
      const turmaRef = await addDoc(collection(db, 'saas_turmas'), { idInstituicao: instRef.id, nome: setupInicial.turmaNome.trim(), dataCriacao: serverTimestamp() });
      setSetupInicial({ instNome: '', turmaNome: '' });
      setTurmaAtiva(turmaRef.id);
      setIsCriandoTarefa(true); // Já abre o form pronto pra ele
      mostrarMsg(setMsgTarefa, 'Ambiente criado! Agora lance sua primeira tarefa.');
    } catch (error) { console.error(error); } finally { setSalvando(false); }
  }

  // --- AÇÕES ESQUERDA: INSTITUIÇÃO E TURMA ---
  async function handleAddInstituicao(e) {
    e.preventDefault(); if (salvando || !novaInstNome.trim()) return; setSalvando(true);
    try { await addDoc(collection(db, 'saas_instituicoes'), { nome: novaInstNome.trim(), dataCriacao: serverTimestamp() }); setNovaInstNome(''); mostrarMsg(setMsgInst, 'Instituição adicionada!'); } finally { setSalvando(false); }
  }
  async function handleExcluirInstituicao(id) { if (window.confirm('Excluir Instituição? (Turmas ficarão órfãs)')) { try { await deleteDoc(doc(db, 'saas_instituicoes', id)); } catch(e){console.error(e)} } }

  async function handleAddTurma(e) {
    e.preventDefault(); if (salvando || !novaTurmaNome.trim() || !instSelecionadaParaTurma) return; setSalvando(true);
    try {
      const docRef = await addDoc(collection(db, 'saas_turmas'), { idInstituicao: instSelecionadaParaTurma, nome: novaTurmaNome.trim(), dataCriacao: serverTimestamp() });
      setTurmaAtiva(docRef.id); setNovaTurmaNome(''); setInstSelecionadaParaTurma(''); setIsCriandoTarefa(false); mostrarMsg(setMsgTurma, 'Turma criada e selecionada!');
    } finally { setSalvando(false); }
  }
  async function handleExcluirTurma(id) { if (window.confirm('Excluir Turma?')) { try { await deleteDoc(doc(db, 'saas_turmas', id)); if(turmaAtiva === id) setTurmaAtiva(''); } catch(e){console.error(e)} } }

  // --- AÇÕES DIREITA: TAREFAS E SUBTAREFAS ---
  const handleAddSubtarefaTemp = (e) => {
    e.preventDefault();
    if(inputSubTemp.trim()) { setSubtarefasTemp([...subtarefasTemp, inputSubTemp.trim()]); setInputSubTemp(''); }
  };
  const handleRemoveSubtarefaTemp = (idx) => { setSubtarefasTemp(subtarefasTemp.filter((_, i) => i !== idx)); };

  async function handleAddTarefa(e) {
    e.preventDefault(); 
    const tituloSeguro = novaTarefa.nome.trim();
    if (salvando || !tituloSeguro || !turmaAtiva) return; setSalvando(true);
    try {
      await addDoc(collection(db, 'saas_tarefas'), { 
        idTurma: turmaAtiva, 
        nome: tituloSeguro, 
        enunciado: novaTarefa.enunciado.trim(), 
        subtarefas: tipoTarefa === 'composta' ? subtarefasTemp : [], 
        dataCriacao: serverTimestamp() 
      });
      // Reseta o formulário educativo
      setNovaTarefa({ nome: '', enunciado: '' }); setTipoTarefa('simples'); setSubtarefasTemp([]); setInputSubTemp(''); setIsCriandoTarefa(false);
      mostrarMsg(setMsgTarefa, 'Tarefa lançada com sucesso!');
    } catch (error) { console.error(error); mostrarMsg(setMsgTarefa, 'Erro ao criar tarefa.'); } finally { setSalvando(false); }
  }
  
  async function handleExcluirTarefa(id) { if (window.confirm('Excluir esta Tarefa inteira?')) { try { await deleteDoc(doc(db, 'saas_tarefas', id)); } catch(e){} } }
  
  async function handleAddSubtarefa(idTarefaPrincipal) {
    const nomeSubtarefa = subtarefaNomes[idTarefaPrincipal]; if (salvando || !nomeSubtarefa?.trim()) return; setSalvando(true);
    try { await updateDoc(doc(db, 'saas_tarefas', idTarefaPrincipal), { subtarefas: arrayUnion(nomeSubtarefa.trim()) }); setSubtarefaNomes({ ...subtarefaNomes, [idTarefaPrincipal]: '' }); } finally { setSalvando(false); }
  }
  async function handleExcluirSubtarefa(idTarefaPrincipal, nomeSubtarefa) { if (window.confirm(`Remover '${nomeSubtarefa}'?`)) { try { await updateDoc(doc(db, 'saas_tarefas', idTarefaPrincipal), { subtarefas: arrayRemove(nomeSubtarefa) }); } catch(e){} } }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors"><ArrowLeft size={24} /></Link>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Settings className="text-blue-600" /> Gestão da Estrutura</h2>
          </div>
        </div>

        {instituicoes.length === 0 ? (
          /* O ZERO STATE - ONBOARDING PERFEITO */
          <div className="flex flex-col items-center justify-center text-center p-10 bg-white rounded-3xl shadow-sm border border-gray-200 animate-in fade-in zoom-in-95">
            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-inner"><Rocket size={40} /></div>
            <h3 className="text-3xl font-black text-gray-800 mb-3">Bem-vindo à sua Sala de Aula!</h3>
            <p className="text-gray-500 mb-10 max-w-lg text-lg">O sistema está vazio. Para começarmos a gerenciar notas e tarefas, precisamos preparar o seu ambiente. Leva 10 segundos!</p>
            
            <form onSubmit={handleCriarSetupInicial} className="w-full max-w-md bg-gray-50 p-8 rounded-2xl border border-gray-100 space-y-5 text-left shadow-sm">
              <div>
                <label className="block text-sm font-bold text-gray-700 uppercase mb-2">1. Qual Instituição você leciona?</label>
                <input required type="text" placeholder="Ex: USP, UFPI, Colégio Elite..." className="w-full p-4 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={setupInicial.instNome} onChange={e => setSetupInicial({...setupInicial, instNome: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 uppercase mb-2">2. Qual o nome da sua primeira Turma?</label>
                <input required type="text" placeholder="Ex: Turma Matutino, Turma 101..." className="w-full p-4 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={setupInicial.turmaNome} onChange={e => setSetupInicial({...setupInicial, turmaNome: e.target.value})} />
              </div>
              <button type="submit" disabled={salvando} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl hover:bg-indigo-700 transition-colors mt-4 text-lg">Criar Ambiente e Começar</button>
            </form>
          </div>
        ) : (
          /* O FLUXO NORMAL DIVIDIDO (DIREITA/ESQUERDA) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* COLUNA ESQUERDA: CADASTROS BÁSICOS */}
            <div className="lg:col-span-4 space-y-6">
              
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-black text-indigo-900 mb-4 flex items-center gap-2 border-b pb-3"><Building2 size={20} /> Instituições</h3>
                {msgInst && <div className="mb-3 p-2 bg-green-100 text-green-800 border border-green-200 rounded text-xs font-bold flex items-center gap-1.5 animate-in fade-in"><CheckCircle size={14} /> {msgInst}</div>}
                <form onSubmit={handleAddInstituicao} className="flex gap-2 mb-4">
                  <input required type="text" placeholder="Nova (Ex: UFPI)" className="flex-1 p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={novaInstNome} onChange={e => setNovaInstNome(e.target.value)} />
                  <button type="submit" disabled={salvando} className="bg-indigo-600 text-white px-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors"><Plus size={18} /></button>
                </form>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {instituicoes.map(inst => (
                    <div key={inst.id} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100"><span className="text-sm font-bold text-gray-700">{inst.nome}</span><button onClick={() => handleExcluirInstituicao(inst.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-black text-teal-900 mb-4 flex items-center gap-2 border-b pb-3"><Users size={20} /> Turmas Atuais</h3>
                {msgTurma && <div className="mb-3 p-2 bg-green-100 text-green-800 border border-green-200 rounded text-xs font-bold flex items-center gap-1.5 animate-in fade-in"><CheckCircle size={14} /> {msgTurma}</div>}
                
                <form onSubmit={handleAddTurma} className="mb-5 bg-teal-50 p-3 rounded-xl border border-teal-100 space-y-3">
                  <select required className="w-full p-2 border border-teal-200 rounded-lg bg-white text-sm outline-none" value={instSelecionadaParaTurma} onChange={e => setInstSelecionadaParaTurma(e.target.value)}>
                    <option value="">Vincular a qual Instituição?</option>
                    {instituicoes.map(inst => <option key={inst.id} value={inst.id}>{inst.nome}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <input required type="text" placeholder="Nome da Turma nova" className="flex-1 p-2 border border-teal-200 rounded-lg text-sm outline-none" value={novaTurmaNome} onChange={e => setNovaTurmaNome(e.target.value)} disabled={!instSelecionadaParaTurma} />
                    <button type="submit" disabled={salvando || !instSelecionadaParaTurma} className="bg-teal-600 text-white px-3 rounded-lg font-bold hover:bg-teal-700"><Plus size={18} /></button>
                  </div>
                </form>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                   {turmas.length === 0 && <p className="text-xs text-gray-400 italic">Nenhuma turma cadastrada.</p>}
                   {turmas.map(turma => {
                     const instPai = instituicoes.find(i => i.id === turma.idInstituicao);
                     const isAtiva = turmaAtiva === turma.id;
                     return (
                       <div key={turma.id} className={`flex justify-between items-center p-3 rounded-lg border shadow-sm transition-all ${isAtiva ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-300' : 'bg-white border-teal-100 hover:border-teal-300'}`}>
                         <div>
                           <span className="text-[10px] font-bold text-teal-600 uppercase block mb-0.5">{instPai ? instPai.nome : 'Sem vínculo'}</span>
                           <span className="text-sm font-bold text-gray-800">{turma.nome}</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <button onClick={() => {setTurmaAtiva(turma.id); setIsCriandoTarefa(false);}} className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${isAtiva ? 'bg-orange-200 text-orange-800' : 'text-teal-600 bg-teal-50 hover:bg-teal-100'}`}>
                             {isAtiva ? 'Aberto 👉' : 'Abrir Central'}
                           </button>
                           <button onClick={() => handleExcluirTurma(turma.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                         </div>
                       </div>
                     )
                   })}
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: A CENTRAL DE TAREFAS */}
            <div className="lg:col-span-8 flex flex-col h-full">
              {!turmaAtiva ? (
                /* AVISO DIRECIONAL SE NÃO TIVER TURMA CLICADA */
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-gray-200 shadow-sm animate-in fade-in">
                  <ArrowLeftCircle size={48} className="text-orange-400 mb-4 animate-pulse" />
                  <h3 className="text-2xl font-black text-gray-800 mb-2">Quase lá!</h3>
                  <p className="text-gray-500 max-w-sm text-lg">Para acessar a Central, clique em <b>"Abrir Central"</b> em alguma Turma no painel à sua esquerda.</p>
                </div>
              ) : (
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-orange-200 border-t-4 border-t-orange-500 flex-1 flex flex-col animate-in fade-in slide-in-from-right-4">
                  
                  {/* CABEÇALHO */}
                  <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <div>
                      <h3 className="text-xl font-black text-orange-900 flex items-center gap-2"><Layers size={24} /> Central de Tarefas</h3>
                      <p className="text-sm text-gray-500 mt-1">Gerenciando: <strong className="text-orange-600">{turmas.find(t=>t.id===turmaAtiva)?.nome}</strong></p>
                    </div>
                    {!isCriandoTarefa && (
                      <button onClick={() => setIsCriandoTarefa(true)} className="bg-orange-600 text-white hover:bg-orange-700 px-5 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-sm"><Plus size={18}/> Nova tarefa</button>
                    )}
                  </div>

                  {msgTarefa && <div className="mb-6 p-3 bg-green-100 text-green-800 border border-green-200 rounded-lg text-sm font-bold flex items-center gap-2 animate-in fade-in"><CheckCircle size={18} /> {msgTarefa}</div>}

                  {/* FORMULÁRIO EDUCATIVO (O SEGREDO DA UX PARA NÍVEL 4) */}
                  {isCriandoTarefa && (
                    <div className="mb-8 bg-orange-50/50 border border-orange-200 p-6 rounded-2xl shadow-sm animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-5">
                        <h4 className="font-bold text-orange-900 flex items-center gap-2 text-lg"><BookOpen size={20}/> Estruturar nova tarefa</h4>
                        <span className="text-xs font-medium text-orange-600 italic">* campo obrigatório</span>
                      </div>
                      
                      <div className="space-y-5">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-orange-800 uppercase mb-1">TÍTULO*</label>
                            <input required type="text" placeholder="Ex: Prova Bimestral ou Módulo 7" className="w-full p-3 border border-orange-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={novaTarefa.nome} onChange={e => setNovaTarefa({...novaTarefa, nome: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-orange-800 uppercase mb-1">ENUNCIADO / ORIENTAÇÕES</label>
                            <input type="text" placeholder="Instruções para o aluno (opcional)" className="w-full p-3 border border-orange-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={novaTarefa.enunciado} onChange={e => setNovaTarefa({...novaTarefa, enunciado: e.target.value})} />
                          </div>
                        </div>

                        {/* O "PULO DO GATO" - Explicando a hierarquia */}
                        <div className="bg-white p-4 rounded-xl border border-orange-100">
                          <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><HelpCircle size={16} className="text-orange-500"/> Como será a estrutura desta tarefa?</label>
                          <div className="flex flex-col md:flex-row gap-4 mb-4">
                            <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${tipoTarefa === 'simples' ? 'bg-orange-50 border-orange-400 ring-1 ring-orange-400' : 'border-gray-200 hover:bg-gray-50'}`}>
                              <input type="radio" name="tipo" checked={tipoTarefa === 'simples'} onChange={() => setTipoTarefa('simples')} className="w-4 h-4 accent-orange-600" />
                              <div><span className="block font-bold text-gray-800 text-sm">Tarefa Única</span><span className="text-xs text-gray-500">Apenas um lançamento de nota.</span></div>
                            </label>
                            <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${tipoTarefa === 'composta' ? 'bg-orange-50 border-orange-400 ring-1 ring-orange-400' : 'border-gray-200 hover:bg-gray-50'}`}>
                              <input type="radio" name="tipo" checked={tipoTarefa === 'composta'} onChange={() => setTipoTarefa('composta')} className="w-4 h-4 accent-orange-600" />
                              <div><span className="block font-bold text-gray-800 text-sm">Módulo (Com Subtarefas)</span><span className="text-xs text-gray-500">Dividido em Questões ou Etapas.</span></div>
                            </label>
                          </div>

                          {/* Se for composta, deixa criar as subdivisões NA HORA */}
                          {tipoTarefa === 'composta' && (
                            <div className="animate-in fade-in border-t border-gray-100 pt-4">
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Criar subdivisões (Nível 4):</label>
                              <div className="flex gap-2 mb-3">
                                <input type="text" placeholder="Ex: Questão 1, Resumo, etc." className="flex-1 p-2 border border-gray-300 rounded text-sm outline-none focus:border-orange-500" value={inputSubTemp} onChange={e=>setInputSubTemp(e.target.value)} onKeyDown={e => {if(e.key==='Enter') handleAddSubtarefaTemp(e)}} />
                                <button type="button" onClick={handleAddSubtarefaTemp} className="bg-gray-800 text-white px-4 rounded text-sm font-bold hover:bg-black transition-colors">Adicionar</button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {subtarefasTemp.length === 0 && <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">⚠️ Adicione ao menos uma subdivisão acima.</span>}
                                {subtarefasTemp.map((sub, i) => (
                                  <span key={i} className="flex items-center gap-1 bg-gray-100 border border-gray-200 text-gray-700 px-2 py-1 rounded text-sm">
                                    {sub} <button type="button" onClick={() => handleRemoveSubtarefaTemp(i)} className="text-red-400 hover:text-red-600 ml-1"><Trash2 size={12}/></button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                          <button type="button" onClick={handleAddTarefa} disabled={salvando} className="flex-1 bg-orange-600 text-white px-6 py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-orange-700 transition-colors shadow-sm"><CheckCircle size={20} /> Salvar e Publicar Tarefa</button>
                          <button type="button" onClick={() => setIsCriandoTarefa(false)} className="bg-gray-200 text-gray-700 px-6 py-3.5 rounded-xl font-bold hover:bg-gray-300 transition-colors">Cancelar</button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* LISTAGEM DE TAREFAS */}
                  <div className="space-y-4 flex-1">
                    {tarefas.length === 0 && !isCriandoTarefa && (
                      <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium mb-4 text-lg">A central desta turma está vazia.</p>
                        <button onClick={() => setIsCriandoTarefa(true)} className="bg-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-700 transition-colors inline-flex items-center gap-2"><Plus size={18}/> Criar a primeira tarefa</button>
                      </div>
                    )}
                    
                    {tarefas.map(tarefa => (
                      <div key={tarefa.id} className="border border-gray-200 bg-white rounded-xl overflow-hidden shadow-sm hover:border-orange-300 transition-colors group">
                        <div className="p-4 flex justify-between items-start">
                          <div>
                            <h4 className="font-black text-gray-800 text-lg leading-tight group-hover:text-orange-700 transition-colors">{tarefa.nome}</h4>
                            {tarefa.enunciado && <p className="text-sm text-gray-500 mt-1">{tarefa.enunciado}</p>}
                          </div>
                          <button onClick={() => handleExcluirTarefa(tarefa.id)} className="text-gray-300 hover:text-red-500 transition-colors ml-4 p-1"><Trash2 size={18}/></button>
                        </div>
                        
                        {/* EDIÇÃO DE SUBTAREFAS */}
                        <div className="p-4 bg-gray-50 border-t border-gray-100">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Subdivisões ({tarefa.subtarefas?.length || 0})</p>
                          </div>
                          <div className="flex gap-2 mb-3">
                            <input type="text" placeholder="Adicionar nova (Ex: Questão Extra)" className="flex-1 p-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-orange-500 bg-white" value={subtarefaNomes[tarefa.id] || ''} onChange={e => setSubtarefaNomes({...subtarefaNomes, [tarefa.id]: e.target.value})} onKeyDown={e => {if(e.key==='Enter') handleAddSubtarefa(tarefa.id)}}/>
                            <button onClick={() => handleAddSubtarefa(tarefa.id)} disabled={salvando || !subtarefaNomes[tarefa.id]?.trim()} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-300 transition-colors disabled:opacity-50">Adicionar</button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(!tarefa.subtarefas || tarefa.subtarefas.length === 0) && <span className="text-xs text-gray-400 italic bg-white px-2 py-1 border rounded">Tarefa Única (Sem subdivisões)</span>}
                            {tarefa.subtarefas?.map((sub, idx) => (
                              <span key={idx} className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg text-sm font-medium shadow-sm">
                                {sub} <button onClick={() => handleExcluirSubtarefa(tarefa.id, sub)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
