import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc, updateDoc, query, onSnapshot, serverTimestamp, orderBy, where, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Plus, Trash2, Settings, Building2, Users, CheckCircle, BookOpen, Layers } from 'lucide-react';

export default function Configuracoes() {
  const [instituicoes, setInstituicoes] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  
  // Estados de Criação Principal
  const [turmaAtiva, setTurmaAtiva] = useState('');
  
  // Estados de Formulários Rápidos
  const [novaTarefa, setNovaTarefa] = useState({ nome: '', enunciado: '' });
  const [novoNomeSubtarefa, setNovoNomeSubtarefa] = useState({});
  const [novaInstNome, setNovaInstNome] = useState('');
  
  // Modal de Criação Rápida (On The Fly)
  const [modalTurmaRapida, setModalTurmaRapida] = useState(false);
  const [novaTurmaRapida, setNovaTurmaRapida] = useState({ nome: '', idInst: '' });

  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  // 1. Buscas (Nível 1 e 2)
  useEffect(() => {
    const unsubInst = onSnapshot(query(collection(db, 'saas_instituicoes'), orderBy('nome', 'asc')), (snap) => setInstituicoes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubTurmas = onSnapshot(query(collection(db, 'saas_turmas'), orderBy('nome', 'asc')), (snap) => setTurmas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => { unsubInst(); unsubTurmas(); };
  }, []);

  // 2. Busca de Tarefas (Nível 3) - Corrigido o bug do "Fantasma" tirando o orderBy direto no Firebase
  useEffect(() => {
    if (!turmaAtiva) { setTarefas([]); return; }
    
    // Agora salvamos na coleção 'saas_tarefas' para ficar com o nome correto no banco também
    const qTarefas = query(collection(db, 'saas_tarefas'), where('idTurma', '==', turmaAtiva));
    const unsub = onSnapshot(qTarefas, (snap) => {
      let dados = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenação feita no JS para evitar erro de índice no Firebase
      dados.sort((a, b) => (a.dataCriacao?.seconds || 0) - (b.dataCriacao?.seconds || 0));
      setTarefas(dados);
    });
    return () => unsub();
  }, [turmaAtiva]);

  const mostrarMensagem = (msg) => { setMensagem(msg); setTimeout(() => setMensagem(''), 3000); };

  // --- AÇÕES NÍVEL 1 ---
  async function handleAddInstituicao(e) {
    e.preventDefault(); if (salvando || !novaInstNome.trim()) return; setSalvando(true);
    try { await addDoc(collection(db, 'saas_instituicoes'), { nome: novaInstNome.trim(), dataCriacao: serverTimestamp() }); setNovaInstNome(''); mostrarMensagem('Instituição adicionada!'); } finally { setSalvando(false); }
  }
  async function handleExcluirInstituicao(id) {
    if (window.confirm('Excluir Instituição?')) { try { await deleteDoc(doc(db, 'saas_instituicoes', id)); } catch(e){console.error(e)} }
  }

  // --- AÇÕES "CRIAR RÁPIDO" NÍVEL 2 ---
  async function handleCriarTurmaRapida(e) {
    e.preventDefault(); if (salvando || !novaTurmaRapida.nome.trim() || !novaTurmaRapida.idInst) return; setSalvando(true);
    try {
      const docRef = await addDoc(collection(db, 'saas_turmas'), { idInstituicao: novaTurmaRapida.idInst, nome: novaTurmaRapida.nome.trim(), dataCriacao: serverTimestamp() });
      setTurmaAtiva(docRef.id); // Já seleciona a turma nova automaticamente
      setModalTurmaRapida(false);
      setNovaTurmaRapida({ nome: '', idInst: '' });
      mostrarMensagem('Turma criada e selecionada!');
    } finally { setSalvando(false); }
  }
  async function handleExcluirTurma(id) {
    if (window.confirm('Excluir Turma?')) { try { await deleteDoc(doc(db, 'saas_turmas', id)); if(turmaAtiva === id) setTurmaAtiva(''); } catch(e){console.error(e)} }
  }

  // --- AÇÕES NÍVEL 3 E 4 (TAREFAS E SUBTAREFAS) ---
  async function handleAddTarefa(e) {
    e.preventDefault(); if (salvando || !novaTarefa.nome.trim() || !turmaAtiva) return; setSalvando(true);
    try {
      await addDoc(collection(db, 'saas_tarefas'), { 
        idTurma: turmaAtiva, 
        nome: novaTarefa.nome.trim(), 
        enunciado: novaTarefa.enunciado.trim(), 
        subtarefas: [], 
        dataCriacao: serverTimestamp() 
      });
      setNovaTarefa({ nome: '', enunciado: '' });
      mostrarMensagem('Tarefa principal criada com sucesso!');
    } finally { setSalvando(false); }
  }
  
  async function handleExcluirTarefa(id) {
    if (window.confirm('Excluir esta Tarefa inteira?')) { try { await deleteDoc(doc(db, 'saas_tarefas', id)); } catch(e){console.error(e)} }
  }

  async function handleAddSubtarefa(idTarefaPrincipal) {
    const nomeSubtarefa = subtarefaNomes[idTarefaPrincipal];
    if (salvando || !nomeSubtarefa?.trim()) return; setSalvando(true);
    try { 
      await updateDoc(doc(db, 'saas_tarefas', idTarefaPrincipal), { subtarefas: arrayUnion(nomeSubtarefa.trim()) }); 
      setSubtarefaNomes({ ...subtarefaNomes, [idTarefaPrincipal]: '' }); 
    } finally { setSalvando(false); }
  }

  async function handleExcluirSubtarefa(idTarefaPrincipal, nomeSubtarefa) {
    if (window.confirm(`Remover subtarefa '${nomeSubtarefa}'?`)) { try { await updateDoc(doc(db, 'saas_tarefas', idTarefaPrincipal), { subtarefas: arrayRemove(nomeSubtarefa) }); } catch(e){console.error(e)} }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors"><ArrowLeft size={24} /></Link>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Settings className="text-blue-600" /> Gestão da Estrutura</h2>
          </div>
          {mensagem && (
            <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold flex items-center gap-2 animate-in fade-in shadow-sm">
              <CheckCircle size={18} /> {mensagem}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* COLUNA ESQUERDA: CADASTROS BÁSICOS (L1 e L2) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-black text-indigo-900 mb-4 flex items-center gap-2 border-b pb-3"><Building2 size={20} /> Instituições</h3>
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

          {/* COLUNA DIREITA: O CORAÇÃO DO SISTEMA (L3 E L4) */}
          <div className="lg:col-span-8">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-orange-200 border-t-4 border-t-orange-500 h-full">
              <h3 className="text-xl font-black text-orange-900 mb-6 flex items-center gap-2 border-b pb-4"><Layers size={24} /> Central de Tarefas</h3>
              
              {/* O NOVO SELETOR INTELIGENTE */}
              <div className="mb-6 bg-orange-50 p-5 rounded-xl border border-orange-100">
                <label className="block text-sm font-bold text-orange-900 mb-2">Para qual Turma você quer lançar Tarefas?</label>
                <select 
                  className="w-full p-3 border border-orange-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white font-medium" 
                  value={turmaAtiva} 
                  onChange={e => {
                    if (e.target.value === 'NOVA') setModalTurmaRapida(true);
                    else setTurmaAtiva(e.target.value);
                  }}
                >
                  <option value="">Selecione uma turma...</option>
                  {turmas.map(t => { 
                    const instPai = instituicoes.find(i => i.id === t.idInstituicao);
                    return <option key={t.id} value={t.id}>{instPai ? `${instPai.nome} > ` : ''}{t.nome}</option>
                  })}
                  <option value="NOVA" className="font-bold text-orange-600 bg-orange-50">✨ + Criar Nova Turma Rápido</option>
                </select>
              </div>

              {/* MODAL/ÁREA DE CRIAÇÃO RÁPIDA DE TURMA (Aparece se ele escolher "Criar Nova Turma") */}
              {modalTurmaRapida && (
                <div className="mb-6 p-5 border-2 border-dashed border-orange-300 bg-orange-50/50 rounded-xl animate-in fade-in">
                  <h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2"><Plus size={18}/> Criação Rápida de Turma</h4>
                  <form onSubmit={handleCriarTurmaRapida} className="flex flex-col md:flex-row gap-3">
                    <select required className="p-2 border rounded-lg bg-white flex-1 outline-none" value={novaTurmaRapida.idInst} onChange={e => setNovaTurmaRapida({...novaTurmaRapida, idInst: e.target.value})}>
                      <option value="">Selecione a Instituição...</option>
                      {instituicoes.map(inst => <option key={inst.id} value={inst.id}>{inst.nome}</option>)}
                    </select>
                    <input required type="text" placeholder="Nome da Turma" className="p-2 border rounded-lg bg-white flex-1 outline-none" value={novaTurmaRapida.nome} onChange={e => setNovaTurmaRapida({...novaTurmaRapida, nome: e.target.value})} />
                    <button type="submit" className="bg-orange-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-orange-700">Salvar e Selecionar</button>
                    <button type="button" onClick={() => setModalTurmaRapida(false)} className="bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-lg hover:bg-gray-300">Cancelar</button>
                  </form>
                  {instituicoes.length === 0 && <p className="text-xs text-red-500 font-bold mt-2">Você precisa criar uma Instituição na coluna ao lado primeiro!</p>}
                </div>
              )}

              {turmaAtiva && !modalTurmaRapida && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  
                  {/* CRIAÇÃO DA TAREFA (NÍVEL 3) */}
                  <form onSubmit={handleAddTarefa} className="mb-8 bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><BookOpen size={18}/> Nova Tarefa</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título da Tarefa *</label>
                        <input required type="text" placeholder="Ex: Prova Bimestral ou Desafio Final" className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={novaTarefa.nome} onChange={e => setNovaTarefa({...novaTarefa, nome: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Enunciado Geral / Orientações (Opcional)</label>
                        <textarea rows="2" placeholder="Descreva aqui o que o aluno deve fazer..." className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm" value={novaTarefa.enunciado} onChange={e => setNovaTarefa({...novaTarefa, enunciado: e.target.value})} />
                      </div>
                      <button type="submit" disabled={salvando} className="w-full bg-orange-600 text-white px-6 py-3 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-orange-700 transition-colors"><Plus size={20} /> Lançar Tarefa</button>
                    </div>
                  </form>
                  
                  {/* LISTAGEM DE TAREFAS */}
                  <div className="space-y-6">
                    {tarefas.length === 0 && <p className="text-sm text-gray-500 italic text-center py-4">Nenhuma tarefa lançada para esta turma.</p>}
                    
                    {tarefas.map(tarefa => (
                      <div key={tarefa.id} className="border border-orange-100 bg-orange-50/20 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-orange-100 p-4 flex justify-between items-start">
                          <div>
                            <h4 className="font-black text-orange-900 text-lg leading-tight">{tarefa.nome}</h4>
                            {tarefa.enunciado && <p className="text-xs text-orange-800 mt-1.5 opacity-80">{tarefa.enunciado}</p>}
                          </div>
                          <button onClick={() => handleExcluirTarefa(tarefa.id)} className="text-red-400 hover:text-red-600 ml-4"><Trash2 size={18}/></button>
                        </div>
                        
                        {/* SUBTAREFAS (NÍVEL 4) */}
                        <div className="p-4 bg-white border-t border-orange-50">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-3">Subdivisões da Tarefa (Opcional)</p>
                          <div className="flex gap-2 mb-4">
                            <input type="text" placeholder="Nome da Subtarefa (Ex: Questão 1)" className="flex-1 p-2 border border-gray-200 rounded text-sm outline-none focus:border-orange-400" value={subtarefaNomes[tarefa.id] || ''} onChange={e => setSubtarefaNomes({...subtarefaNomes, [tarefa.id]: e.target.value})} />
                            <button onClick={() => handleAddSubtarefa(tarefa.id)} disabled={salvando || !subtarefaNomes[tarefa.id]?.trim()} className="bg-orange-500 text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50 hover:bg-orange-600 transition-colors">Adicionar</button>
                          </div>
                          <div className="space-y-2">
                            {(!tarefa.subtarefas || tarefa.subtarefas.length === 0) && <p className="text-xs text-gray-400 italic">Tarefa única (Sem subtarefas cadastradas).</p>}
                            {tarefa.subtarefas?.map((sub, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-2 rounded text-sm"><span className="font-medium text-gray-700">{sub}</span><button onClick={() => handleExcluirSubtarefa(tarefa.id, sub)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></div>
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

        </div>
      </div>
    </div>
  );
}
