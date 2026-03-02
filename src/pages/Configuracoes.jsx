import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Plus, Trash2, Settings, AlertTriangle, Database, CheckCircle } from 'lucide-react';

export default function Configuracoes() {
  const [modulos, setModulos] = useState([]);
  const [tarefasLegadas, setTarefasLegadas] = useState([]); // As tarefas antigas soltas
  const [novoModulo, setNovoModulo] = useState('');
  const [salvando, setSalvando] = useState(false);
  
  // Estados para as novas tarefas aninhadas
  const [novaTarefaModulo, setNovaTarefaModulo] = useState({}); 

  // Estados da Ferramenta de Migração
  const [simulacao, setSimulacao] = useState(null);
  const [migracaoConcluida, setMigracaoConcluida] = useState(false);

  useEffect(() => {
    const qModulos = query(collection(db, 'modulos'), orderBy('nome', 'asc'));
    const unsubModulos = onSnapshot(qModulos, (snap) => {
      setModulos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Mantemos a leitura das tarefas antigas apenas para podermos migrar
    const qTarefas = query(collection(db, 'tarefas'), orderBy('nome', 'asc'));
    const unsubTarefas = onSnapshot(qTarefas, (snap) => {
      setTarefasLegadas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubModulos(); unsubTarefas(); };
  }, []);

  // ==========================================
  // 1. CRUD DE MÓDULOS (Agora nasce com array de tarefas)
  // ==========================================
  async function handleAddModulo(e) {
    e.preventDefault();
    if (salvando || !novoModulo.trim()) return;
    setSalvando(true);
    try {
      await addDoc(collection(db, 'modulos'), { 
        nome: novoModulo.trim(),
        tarefas: [] // NOVA ARQUITETURA: Nasce com o array de filhos
      });
      setNovoModulo('');
    } catch (error) { console.error("Erro:", error); } finally { setSalvando(false); }
  }

  async function handleExcluirModulo(id) {
    if (salvando) return;
    if (window.confirm('Tem certeza que deseja excluir este módulo e todas as tarefas dele?')) {
      setSalvando(true);
      try { await deleteDoc(doc(db, 'modulos', id)); } finally { setSalvando(false); }
    }
  }

  // ==========================================
  // 2. CRUD DE TAREFAS ANINHADAS
  // ==========================================
  async function handleAddTarefaNoModulo(moduloId, listaAtual) {
    const nomeTarefa = novaTarefaModulo[moduloId];
    if (salvando || !nomeTarefa || !nomeTarefa.trim()) return;
    
    setSalvando(true);
    try {
      const novaLista = [...(listaAtual || []), nomeTarefa.trim()];
      await updateDoc(doc(db, 'modulos', moduloId), { tarefas: novaLista });
      setNovaTarefaModulo(prev => ({ ...prev, [moduloId]: '' }));
    } catch (error) { console.error("Erro:", error); } finally { setSalvando(false); }
  }

  async function handleExcluirTarefaDoModulo(moduloId, nomeTarefaParaExcluir, listaAtual) {
    if (salvando) return;
    if (window.confirm(`Excluir a tarefa "${nomeTarefaParaExcluir}"?`)) {
      setSalvando(true);
      try {
        const novaLista = listaAtual.filter(t => t !== nomeTarefaParaExcluir);
        await updateDoc(doc(db, 'modulos', moduloId), { tarefas: novaLista });
      } catch (error) { console.error("Erro:", error); } finally { setSalvando(false); }
    }
  }

  // ==========================================
  // 3. O MOTOR DE MIGRAÇÃO (DRY RUN)
  // ==========================================
  const simularMigracao = () => {
    const mapa = {};
    
    // Inicializa o mapa com os módulos existentes
    modulos.forEach(m => {
      mapa[m.id] = { nome: m.nome, tarefasAInserir: [] };
    });

    tarefasLegadas.forEach(tar => {
      let nomeModuloDestino = null;
      const nomeLow = tar.nome.toLowerCase();

      // Regra 1: Atividades Específicas do Módulo 6
      if (['atividade 02', 'atividade 04', 'atividade 06'].includes(nomeLow)) {
        nomeModuloDestino = "Módulo 6";
      }
      // Regra 2: Módulo Recuperação
      else if (nomeLow.includes('semanas 01 a 03') || nomeLow.includes('semanas 04 a 06') || nomeLow.includes('semanas 07 a 09')) {
        nomeModuloDestino = "Módulo Recuperação";
      }
      // Regra 3: Módulos Síncronos
      else if (nomeLow.startsWith('síncrono-')) {
        const match = tar.nome.match(/^(Síncrono-S\d+)/i);
        if (match) nomeModuloDestino = match[1];
      }
      // Regra 4: Padrão M01, M08, etc.
      else {
        const match = nomeLow.match(/^m\s*0?(\d+)/i);
        if (match) {
          nomeModuloDestino = `Módulo ${match[1]}`;
        }
      }

      // Procura o ID do módulo com base no nome descoberto
      if (nomeModuloDestino) {
        const moduloEncontrado = modulos.find(m => m.nome.toLowerCase() === nomeModuloDestino.toLowerCase());
        if (moduloEncontrado) {
          mapa[moduloEncontrado.id].tarefasAInserir.push(tar.nome);
        } else {
          console.warn(`Atenção: A tarefa "${tar.nome}" pediu o módulo "${nomeModuloDestino}", mas ele não existe no banco.`);
        }
      }
    });

    setSimulacao(mapa);
  };

  const efetivarMigracao = async () => {
    if (!simulacao) return;
    if (!window.confirm("Atenção: Isso vai gravar as tarefas dentro dos módulos no banco de dados. Confirma?")) return;

    setSalvando(true);
    try {
      // Grava a lista nova em cada módulo
      const promessas = Object.keys(simulacao).map(async (modId) => {
        const tarefasDaSimulacao = simulacao[modId].tarefasAInserir;
        if (tarefasDaSimulacao.length > 0) {
          const modRef = doc(db, 'modulos', modId);
          // O Set elimina possíveis duplicações caso uma tarefa já exista lá
          const moduloOriginal = modulos.find(m => m.id === modId);
          const listaAtual = moduloOriginal?.tarefas || [];
          const listaUnica = Array.from(new Set([...listaAtual, ...tarefasDaSimulacao]));
          
          await updateDoc(modRef, { tarefas: listaUnica });
        }
      });

      await Promise.all(promessas);
      setMigracaoConcluida(true);
      setSimulacao(null);
    } catch (error) {
      console.error("Erro na migração:", error);
      alert("Erro ao gravar os dados.");
    } finally {
      setSalvando(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Settings className="text-blue-600" />
            Configurações do Sistema
          </h2>
        </div>

        {/* NOVA ÁREA DE MÓDULOS (RELACIONAL) */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">Gerenciamento Estrutural (Módulos e Tarefas)</h3>
          
          <form onSubmit={handleAddModulo} className="flex gap-2 mb-8 bg-blue-50 p-4 rounded-xl border border-blue-100">
            <input required type="text" placeholder="Criar novo Módulo (Ex: Módulo 9...)" className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={novoModulo} onChange={e => setNovoModulo(e.target.value)} />
            <button type="submit" disabled={salvando} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-bold disabled:opacity-50">
              Criar Módulo
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {modulos.length === 0 && <div className="col-span-2 text-center text-gray-500 py-8">Nenhum módulo cadastrado.</div>}
            
            {modulos.map(mod => (
              <div key={mod.id} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
                <div className="bg-gray-800 p-4 flex justify-between items-center text-white">
                  <span className="font-bold">{mod.nome}</span>
                  <button onClick={() => handleExcluirModulo(mod.id)} disabled={salvando} className="text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={18} /></button>
                </div>
                
                <div className="p-4 flex-1">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tarefas deste módulo:</h4>
                  
                  <ul className="space-y-2 mb-4">
                    {(!mod.tarefas || mod.tarefas.length === 0) && <li className="text-sm text-gray-400 italic">Nenhuma tarefa associada.</li>}
                    {mod.tarefas?.map((tar, idx) => (
                      <li key={idx} className="bg-white border border-gray-100 p-2 rounded-lg flex justify-between items-center text-sm">
                        <span className="font-medium text-gray-700">{tar}</span>
                        <button onClick={() => handleExcluirTarefaDoModulo(mod.id, tar, mod.tarefas)} disabled={salvando} className="text-red-300 hover:text-red-500"><Trash2 size={16}/></button>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
                  <input type="text" placeholder="Nova tarefa..." className="flex-grow p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={novaTarefaModulo[mod.id] || ''} 
                    onChange={e => setNovaTarefaModulo(prev => ({ ...prev, [mod.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAddTarefaNoModulo(mod.id, mod.tarefas)}
                  />
                  <button onClick={() => handleAddTarefaNoModulo(mod.id, mod.tarefas)} disabled={salvando} className="bg-gray-800 text-white px-3 py-2 rounded-md hover:bg-black transition-colors">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FERRAMENTA DE MIGRAÇÃO (PERFIL DE ARQUITETO) */}
        <div className="bg-orange-50 p-6 md:p-8 rounded-2xl shadow-sm border border-orange-200">
          <div className="flex items-center gap-3 mb-4">
            <Database className="text-orange-500" size={28} />
            <div>
              <h3 className="text-xl font-black text-orange-900">Ferramenta de Migração de Dados (Dry Run)</h3>
              <p className="text-sm font-medium text-orange-700">Cruza as {tarefasLegadas.length} tarefas legadas e as injeta dentro dos módulos corretos.</p>
            </div>
          </div>

          {!simulacao && !migracaoConcluida && (
            <button onClick={simularMigracao} className="bg-orange-600 text-white font-bold py-3 px-6 rounded-xl shadow-md hover:bg-orange-700 active:scale-95 transition-all">
              1. Simular Migração (Pré-visualizar)
            </button>
          )}

          {migracaoConcluida && (
            <div className="bg-green-100 text-green-800 p-4 rounded-xl font-bold flex items-center gap-2 border border-green-200">
              <CheckCircle size={24} /> Migração Concluída com Sucesso! Os módulos agora possuem suas próprias tarefas.
            </div>
          )}

          {simulacao && !migracaoConcluida && (
            <div className="mt-6">
              <div className="bg-white p-4 rounded-xl border border-orange-200 mb-6 max-h-96 overflow-y-auto">
                <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">Pré-visualização do Cruzamento:</h4>
                <div className="space-y-4">
                  {Object.keys(simulacao).map(modId => {
                    const moduloInfo = simulacao[modId];
                    if (moduloInfo.tarefasAInserir.length === 0) return null;
                    return (
                      <div key={modId} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <strong className="text-blue-800 block mb-2">{moduloInfo.nome} <span className="text-gray-500 font-normal text-sm">receberá:</span></strong>
                        <div className="flex flex-wrap gap-2">
                          {moduloInfo.tarefasAInserir.map((t, i) => (
                            <span key={i} className="bg-white text-xs font-bold border px-2 py-1 rounded text-gray-700">{t}</span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={efetivarMigracao} disabled={salvando} className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-red-700 active:scale-95 transition-all flex justify-center items-center gap-2">
                  <AlertTriangle size={20} /> 2. Aprovar e Gravar no Banco
                </button>
                <button onClick={() => setSimulacao(null)} className="px-6 bg-gray-300 text-gray-800 font-bold rounded-xl hover:bg-gray-400 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
