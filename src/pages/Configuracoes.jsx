import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc, updateDoc, query, onSnapshot, serverTimestamp, orderBy, where, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Plus, Trash2, Settings, Building2, Users, CheckCircle, BookOpen, Layers, Rocket } from 'lucide-react';

export default function Configuracoes() {
  const [instituicoes, setInstituicoes] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  
  const [turmaAtiva, setTurmaAtiva] = useState('');
  const [isCriandoTarefa, setIsCriandoTarefa] = useState(false);
  
  const [novaTarefa, setNovaTarefa] = useState({ nome: '', enunciado: '' });
  const [subtarefaNomes, setSubtarefaNomes] = useState({}); 
  const [novaInstNome, setNovaInstNome] = useState('');
  
  // O SEGREDO DO ZERO STATE: Estado para o Setup Inicial
  const [setupInicial, setSetupInicial] = useState({ instNome: '', turmaNome: '' });

  const [modalTurmaRapida, setModalTurmaRapida] = useState(false);
  const [novaTurmaRapida, setNovaTurmaRapida] = useState({ nome: '', idInst: '' });

  const [salvando, setSalvando] = useState(false);
  
  const [msgInst, setMsgInst] = useState('');
  const [msgTurma, setMsgTurma] = useState('');
  const [msgTarefa, setMsgTarefa] = useState('');

  // 1. Buscas
  useEffect(() => {
    const unsubInst = onSnapshot(query(collection(db, 'saas_instituicoes'), orderBy('nome', 'asc')), (snap) => setInstituicoes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubTurmas = onSnapshot(query(collection(db, 'saas_turmas'), orderBy('nome', 'asc')), (snap) => setTurmas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => { unsubInst(); unsubTurmas(); };
  }, []);

  useEffect(() => {
    if (!turmaAtiva) { 
      setTarefas([]); 
      setIsCriandoTarefa(false); 
      return; 
    }
    const qTarefas = query(collection(db, 'saas_tarefas'), where('idTurma', '==', turmaAtiva));
    const unsub = onSnapshot(qTarefas, (snap) => {
      let dados = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      dados.sort((a, b) => {
        const timeA = (a.dataCriacao && a.dataCriacao.seconds) ? a.dataCriacao.seconds : 0;
        const timeB = (b.dataCriacao && b.dataCriacao.seconds) ? b.dataCriacao.seconds : 0;
        return timeA - timeB;
      });
      setTarefas(dados);
    });
    return () => unsub();
  }, [turmaAtiva]);

  const mostrarMsg = (setter, texto) => { setter(texto); setTimeout(() => setter(''), 5000); };

  // --- AÇÃO MÁGICA DO ONBOARDING (Cria Inst e Turma de uma vez) ---
  async function handleCriarSetupInicial(e) {
    e.preventDefault();
    if (salvando || !setupInicial.instNome.trim() || !setupInicial.turmaNome.trim()) return;
    setSalvando(true);
    try {
      // 1. Salva a Instituição
      const instRef = await addDoc(collection(db, 'saas_instituicoes'), { nome: setupInicial.instNome.trim(), dataCriacao: serverTimestamp() });
      // 2. Salva a Turma amarrada nela
      const turmaRef = await addDoc(collection(db, 'saas_turmas'), { idInstituicao: instRef.id, nome: setupInicial.turmaNome.trim(), dataCriacao: serverTimestamp() });
      
      // 3. Prepara a tela pro usuário já criar a tarefa
      setSetupInicial({ instNome: '', turmaNome: '' });
      setTurmaAtiva(turmaRef.id);
      setIsCriandoTarefa(true);
      mostrarMsg(setMsgTarefa, 'Ambiente criado! Agora lance sua primeira tarefa.');
    } catch (error) { console.error(error); } finally { setSalvando(false); }
  }

  // --- AÇÕES NÍVEL 1 E 2 TRADICIONAIS ---
  async function handleAddInstituicao(e) {
    e.preventDefault(); if (salvando || !novaInstNome.trim()) return; setSalvando(true);
    try { await addDoc(collection(db, 'saas_instituicoes'), { nome: novaInstNome.trim(), dataCriacao: serverTimestamp() }); setNovaInstNome(''); mostrarMsg(setMsgInst, 'Instituição adicionada!'); } finally { setSalvando(false); }
  }
  async function handleExcluirInstituicao(id) {
    if (window.confirm('Excluir Instituição? (Turmas ficarão órfãs)')) { try { await deleteDoc(doc(db, 'saas_instituicoes', id)); } catch(e){console.error(e)} }
  }

  async function handleCriarTurmaRapida(e) {
    e.preventDefault(); if (salvando || !novaTurmaRapida.nome.trim() || !novaTurmaRapida.idInst) return; setSalvando(true);
    try {
      const docRef = await addDoc(collection(db, 'saas_turmas'), { idInstituicao: novaTurmaRapida.idInst, nome: novaTurmaRapida.nome.trim(), dataCriacao: serverTimestamp() });
      setTurmaAtiva(docRef.id); setModalTurmaRapida(false); setNovaTurmaRapida({ nome: '', idInst: '' }); setIsCriandoTarefa(true); mostrarMsg(setMsgTurma, 'Turma criada e selecionada!');
    } finally { setSalvando(false); }
  }
  async function handleExcluirTurma(id) {
    if (window.confirm('Excluir Turma?')) { try { await deleteDoc(doc(db, 'saas_turmas', id)); if(turmaAtiva === id) setTurmaAtiva(''); } catch(e){console.error(e)} }
  }

  // --- AÇÕES NÍVEL 3 E 4 ---
  async function handleAddTarefa(e) {
    e.preventDefault(); const tituloSeguro = (novaTarefa.nome || '').trim(); const enunciadoSeguro = (novaTarefa.enunciado || '').trim();
    if (salvando || !tituloSeguro || !turmaAtiva) return; setSalvando(true);
    try {
      await addDoc(collection(db, 'saas_tarefas'), { idTurma: turmaAtiva, nome: tituloSeguro, enunciado: enunciadoSeguro, subtarefas: [], dataCriacao: serverTimestamp() });
      setNovaTarefa({ nome: '', enunciado: '' }); setIsCriandoTarefa(false); mostrarMsg(setMsgTarefa, 'Tarefa criada com sucesso!');
    } catch (error) { console.error(error); mostrarMsg(setMsgTarefa, 'Erro ao criar tarefa.'); } finally { setSalvando(false); }
  }
  async function handleExcluirTarefa(id) { if (window.confirm('Excluir esta Tarefa inteira?')) { try { await deleteDoc(doc(db, 'saas_tarefas', id)); } catch(e){console.error(e)} } }
  
  async function handleAddSubtarefa(idTarefaPrincipal) {
    const nomeSubtarefa = subtarefaNomes[idTarefaPrincipal]; if (salvando || !nomeSubtarefa?.trim()) return; setSalvando(true);
    try { await updateDoc(doc(db, 'saas_tarefas', idTarefaPrincipal), { subtarefas: arrayUnion(nomeSubtarefa.trim()) }); setSubtarefaNomes({ ...subtarefaNomes, [idTarefaPrincipal]: '' }); } finally { setSalvando(false); }
  }
  async function handleExcluirSubtarefa(idTarefaPrincipal, nomeSubtarefa) { if (window.confirm(`Remover subtarefa '${nomeSubtarefa}'?`)) { try { await updateDoc(doc(db, 'saas_tarefas', idTarefaPrincipal), { subtarefas: arrayRemove(nomeSubtarefa) }); } catch(e){console.error(e)} } }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors"><ArrowLeft size={24} /></Link>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Settings className="text-blue-600" /> Gestão da Estrutura</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* COLUNA ESQUERDA: CADASTROS BÁSICOS */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-black text-indigo-900 mb-4 flex items-center gap-2 border-b pb-3"><Building2 size={20} /> Instituições</h3>
              {msgInst && <div className="mb-3 p-2 bg-green-100 text-green-800 border border-green-200 rounded text-xs font-bold flex items-center gap-1.5 animate-in fade-in"><CheckCircle size={14} /> {msgInst}</div>}
              <form onSubmit={handleAddInstituicao} className="flex gap-2 mb-4">
                <input required type="text" placeholder="Nova (Ex: UFPI)" className="flex-1 p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={novaInstNome} onChange={e => setNovaInstNome(e.target.value)} />
                <button type="submit" disabled={salvando} className="bg-indigo-600 text-white px-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors"><Plus size={18} /></button>
              </form>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {instituicoes.length === 0 && <p className="text-xs text-gray-400 italic">Nenhuma cadastrada.</p>}
                {instituicoes.map(inst => (
                  <div key={inst.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100"><span className="text-sm font-bold text-gray-700">{inst.nome}</span><button onClick={() => handleExcluirInstituicao(inst.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-black text-teal-900 mb-4 flex items-center gap-2 border-b pb-3"><Users size={20} /> Turmas Atuais</h3>
              {msgTurma && <div className="mb-3 p-2 bg-green-100 text-green-800 border border-green-200 rounded text-xs font-bold flex items-center gap-1.5 animate-in fade-in"><CheckCircle size={14} /> {msgTurma}</div>}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                 {turmas.length === 0 && <p className="text-xs text-gray-400 italic">Nenhuma turma cadastrada.</p>}
                 {turmas.map(turma => {
                   const instPai = instituicoes.find(i => i.id === turma.idInstituicao);
                   return (
                     <div key={turma.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-teal-100 shadow-sm hover:border-teal-300">
                       <div>
                         <span className="text-[10px] font-bold text-teal-600 uppercase block mb-0.5">{instPai ? instPai.nome : 'Sem vínculo'}</span>
                         <span className="text-sm font-bold text-gray-800">{turma.nome}</span>
                       </div>
                       <div className="flex items-center gap-2">
                         <button onClick={() => setTurmaAtiva(turma.id)} className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded hover:bg-teal-100">Selecionar</button>
                         <button onClick={() => handleExcluirTurma(turma.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                       </div>
                     </div>
                   )
                 })}
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: A CENTRAL DE TAREFAS */}
          <div className="lg:col-span-8">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-orange-200 border-t-4 border-t-orange-500 h-full flex flex-col">
              <h3 className="text-xl font-black text-orange-900 mb-6 flex items-center gap-2 border-b pb-4"><Layers size={24} /> Central de Tarefas</h3>
              
              {/* O NOVO "ZERO STATE" - SE NÃO TIVER NADA NO SISTEMA, MOSTRA ISSO */}
              {instituicoes.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-orange-50 to-white rounded-2xl border border-orange-100 animate-in fade-in zoom-in-95">
                  <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-6 shadow-sm"><Rocket size={32} /></div>
                  <h3 className="text-2xl font-black text-gray-800 mb-2">Bem-vindo à sua Central!</h3>
                  <p className="text-gray-500 mb-8 max-w-md">Para começar a lançar tarefas, vamos preparar o seu primeiro ambiente de ensino de forma rápida.</p>
                  
                  <form onSubmit={handleCriarSetupInicial} className="w-full max-w-md bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4 text-left">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Qual Instituição você leciona?</label>
                      <input required type="text" placeholder="Ex: USP, UFPI, Colégio Elite..." className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={setupInicial.instNome} onChange={e => setSetupInicial({...setupInicial, instNome: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Qual o nome da sua primeira Turma?</label>
                      <input required type="text" placeholder="Ex: Turma Matutino, Turma 101..." className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={setupInicial.turmaNome} onChange={e => setSetupInicial({...setupInicial, turmaNome: e.target.value})} />
                    </div>
                    <button type="submit" disabled={salvando} className="w-full bg-orange-600 text-white font-black py-4 rounded-lg hover:bg-orange-700 transition-colors mt-4">Criar Ambiente e Começar</button>
                  </form>
                </div>
              ) : (
                /* FLUXO NORMAL SE ELE JÁ TIVER INSTITUIÇÕES */
                <>
                  <div className="mb-6 bg-orange-50 p-5 rounded-xl border border-orange-100">
                    <label className="block text-sm font-bold text-orange-900 mb-2">Selecione a turma para gerenciar suas tarefas:</label>
                    <select className="w-full p-3 border border-orange-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white font-medium" value={turmaAtiva} onChange={e => { if (e.target.value === 'NOVA') setModalTurmaRapida(true); else setTurmaAtiva(e.target.value); }}>
                      <option value="">Selecione uma turma...</option>
                      {turmas.map(t => { 
                        const instPai = instituicoes.find(i => i.id === t.idInstituicao);
                        return <option key={t.id} value={t.id}>{instPai ? `${instPai.nome} > ` : ''}{t.nome}</option>
                      })}
                      <option value="NOVA" className="font-bold text-orange-600 bg-orange-50">✨ + Criar nova turma</option>
                    </select>
                  </div>

                  {msgTarefa && <div className="mb-6 p-3 bg-green-100 text-green-800 border border-green-200 rounded-lg text-sm font-bold flex items-center gap-2 animate-in fade-in"><CheckCircle size={18} /> {msgTarefa}</div>}

                  {modalTurmaRapida && (
                    <div className="mb-6 p-5 border-2 border-dashed border-orange-300 bg-orange-50/50 rounded-xl animate-in fade-in">
                      <h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2"><Plus size={18}/> Criação Rápida de Turma</h4>
                      <form onSubmit={handleCriarTurmaRapida} className="flex flex-col md:flex-row gap-3">
                        <select required className="p-2 border rounded-lg bg-white flex-1 outline-none" value={novaTurmaRapida.idInst} onChange={e => setNovaTurmaRapida({...novaTurmaRapida, idInst: e.target.value})}>
                          <option value="">Selecione a Instituição...</option>
                          {instituicoes.map(inst => <option key={inst.id} value={inst.id}>{inst.nome}</option>)}
                        </select>
                        <input required type="text" placeholder="Nome da Turma" className="p-2 border rounded-lg bg-white flex-1 outline-none" value={novaTurmaRapida.nome} onChange={e => setNovaTurmaRapida({...novaTurmaRapida, nome: e.target.value})} />
                        <button type="submit" className="bg-orange-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-orange-700">Salvar</button>
                        <button type="button" onClick={() => setModalTurmaRapida(false)} className="bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-lg hover:bg-gray-300">Cancelar</button>
                      </form>
                    </div>
                  )}

                  {turmaAtiva && !modalTurmaRapida && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1 flex flex-col">
                      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-3">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2"><BookOpen size={18}/> Tarefas da Turma</h4>
                        {!isCriandoTarefa && (
                          <button onClick={() => setIsCriandoTarefa(true)} className="bg-orange-100 text-orange-700 hover:bg-orange-200 px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2"><Plus size={16}/> Nova tarefa</button>
                        )}
                      </div>

                      {isCriandoTarefa && (
                        <form onSubmit={handleAddTarefa} className="mb-8 bg-orange-50 border border-orange-200 p-5 rounded-xl shadow-sm animate-in slide-in-from-top-2">
                          <div className="flex justify-between items-center mb-4 border-b border-orange-100 pb-3">
                            <h4 className="font-bold text-orange-900 flex items-center gap-2">Cadastrar nova tarefa</h4>
                            <span className="text-xs font-medium text-orange-600 italic">* campo obrigatório</span>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold text-orange-800 uppercase mb-1">TÍTULO*</label>
                              <input required type="text" placeholder="Ex: Prova Bimestral ou Desafio Final" className="w-full p-3 border border-orange-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={novaTarefa.nome} onChange={e => setNovaTarefa({...novaTarefa, nome: e.target.value})} />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-orange-800 uppercase mb-1">ENUNCIADO</label>
                              <textarea rows="2" placeholder="Descreva aqui o que o aluno deve fazer..." className="w-full p-3 border border-orange-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm" value={novaTarefa.enunciado} onChange={e => setNovaTarefa({...novaTarefa, enunciado: e.target.value})} />
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                              <button type="submit" disabled={salvando} className="flex-1 bg-orange-600 text-white px-6 py-3 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-orange-700 transition-colors"><CheckCircle size={20} /> Salvar Tarefa</button>
                              <button type="button" onClick={() => setIsCriandoTarefa(false)} className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors">Cancelar</button>
                            </div>
                          </div>
                        </form>
                      )}
                      
                      <div className="space-y-6 flex-1">
                        {tarefas.length === 0 && !isCriandoTarefa && (
                          <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-gray-500 font-medium mb-3">Esta turma ainda não possui tarefas.</p>
                            <button onClick={() => setIsCriandoTarefa(true)} className="bg-orange-500 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-orange-600 transition-colors inline-flex items-center gap-2"><Plus size={18}/> Criar a primeira tarefa</button>
                          </div>
                        )}
                        
                        {tarefas.map(tarefa => (
                          <div key={tarefa.id} className="border border-orange-100 bg-orange-50/20 rounded-xl overflow-hidden shadow-sm hover:border-orange-300 transition-colors">
                            <div className="bg-orange-100 p-4 flex justify-between items-start">
                              <div><h4 className="font-black text-orange-900 text-lg leading-tight">{tarefa.nome}</h4>{tarefa.enunciado && <p className="text-xs text-orange-800 mt-1.5 opacity-80">{tarefa.enunciado}</p>}</div>
                              <button onClick={() => handleExcluirTarefa(tarefa.id)} className="text-red-400 hover:text-red-600 ml-4"><Trash2 size={18}/></button>
                            </div>
                            
                            <div className="p-4 bg-white border-t border-orange-50">
                              <p className="text-xs font-bold text-gray-400 uppercase mb-3">Subdivisões da Tarefa (Opcional)</p>
                              <div className="flex gap-2 mb-4">
                                <input type="text" placeholder="Nome da Subtarefa (Ex: Questão 1)" className="flex-1 p-2 border border-gray-200 rounded text-sm outline-none focus:border-orange-400" value={subtarefaNomes[tarefa.id] || ''} onChange={e => setSubtarefaNomes({...subtarefaNomes, [tarefa.id]: e.target.value})} />
                                <button onClick={() => handleAddSubtarefa(tarefa.id)} disabled={salvando || !subtarefaNomes[tarefa.id]?.trim()} className="bg-orange-500 text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50 hover:bg-orange-600 transition-colors">Adicionar</button>
                              </div>
                              <div className="space-y-2">
                                {(!tarefa.subtarefas || tarefa.subtarefas.length === 0) && <p className="text-xs text-gray-400 italic">Tarefa única (Sem subtarefas cadastradas).</p>}
                                {tarefa.subtarefas?.map((sub, idx) => (<div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-2 rounded text-sm"><span className="font-medium text-gray-700">{sub}</span><button onClick={() => handleExcluirSubtarefa(tarefa.id, sub)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></div>))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
