import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Check, X, ClipboardList, User } from 'lucide-react';

// Importando a inteligência do Cronograma Oficial
import { cronogramaAssincrono, getStatusData } from '../data/cronogramaData';

const isModuloValido = (nome) => {
  if (!nome) return false;
  const lower = nome.toLowerCase();
  if (lower.includes('recupera')) return false;
  const match = lower.match(/\d+/);
  if (match && parseInt(match[0], 10) < 7) return false;
  return true; 
};

const extractNum = (nome) => {
  if (!nome) return 0;
  const match = nome.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

// 🔥 FUNÇÃO INTELIGENTE: Padroniza os nomes para evitar colunas duplicadas
const normalizarNomeTarefa = (nome) => {
  if (!nome) return '';
  let n = nome.replace(/\s*-\s*/g, ' - ').trim();
  if (n.toLowerCase().includes('desafio')) return n.split(' - ')[0].toUpperCase() + ' - Desafio';
  if (n.toLowerCase().includes('fórum') || n.toLowerCase().includes('forum')) return n.split(' - ')[0].toUpperCase() + ' - Fórum';
  return n;
};

export default function MapaEntregas() {
  const [alunos, setAlunos] = useState([]);
  const [tarefasMapeadas, setTarefasMapeadas] = useState([]);
  const [entregas, setEntregas] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Ouvinte de Alunos Ativos
    const unsubAlunos = onSnapshot(collection(db, 'alunos'), (snap) => {
      setAlunos(snap.docs.map(doc => doc.data().nome).sort());
    });

    // 2. Ouvinte de Atividades (Últimos 90 dias)
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 90);
    const qAtividades = query(collection(db, 'atividades'), where('dataCriacao', '>=', dataLimite));

    const unsubAtividades = onSnapshot(qAtividades, (snap) => {
      const ativs = snap.docs.map(doc => doc.data());
      
      const setEntregasTemp = new Set();
      const modulosMap = {};
      let maxNumDB = 0;

      ativs.forEach(a => {
        const alunoNome = a.aluno || a.nomeAluno;
        const tarefaRaw = a.tarefa || a.nomeTarefa;
        const moduloNome = a.modulo || a.nomeModulo || '';

        if (!alunoNome || !tarefaRaw || alunoNome.toLowerCase() === 'enunciado') return;
        if (!isModuloValido(moduloNome)) return;

        const tarefaNome = normalizarNomeTarefa(tarefaRaw);
        const temConteudo = (a.resposta && String(a.resposta).trim() !== '') || !!a.arquivoUrl;
        
        const num = extractNum(moduloNome);
        if (num > maxNumDB) maxNumDB = num;

        if (temConteudo) {
          setEntregasTemp.add(`${alunoNome}-${num}-${tarefaNome}`);
        }
        
        if (!modulosMap[num]) modulosMap[num] = { nome: moduloNome, numero: num, tarefas: new Set() };
        modulosMap[num].tarefas.add(tarefaNome);
      });

      const moduloAtualIndex = cronogramaAssincrono.findIndex(m => getStatusData(m.inicio, m.fim) === 'atual');
      const moduloAtual = moduloAtualIndex !== -1 ? cronogramaAssincrono[moduloAtualIndex] : null;

      const numeroAlvoPrincipal = moduloAtual ? extractNum(moduloAtual.modulo) : maxNumDB;
      const numsAlvo = [numeroAlvoPrincipal, numeroAlvoPrincipal - 1].filter(n => n >= 7);

      numsAlvo.forEach(numAlvo => {
        const cronoMod = cronogramaAssincrono.find(m => extractNum(m.modulo) === numAlvo);
        const nomeLabel = cronoMod ? cronoMod.modulo : `Módulo ${numAlvo}`;

        if (!modulosMap[numAlvo]) {
          modulosMap[numAlvo] = { nome: nomeLabel, numero: numAlvo, tarefas: new Set() };
        }

        const tarefasOficiais = cronoMod?.tarefas || [`M${numAlvo < 10 ? '0'+numAlvo : numAlvo} - Desafio`, `M${numAlvo < 10 ? '0'+numAlvo : numAlvo} - Fórum`];
        tarefasOficiais.forEach(t => modulosMap[numAlvo].tarefas.add(normalizarNomeTarefa(t)));
      });

      const listaMod = Object.values(modulosMap).sort((a, b) => b.numero - a.numero);
      
      const colunas = [];
      listaMod.forEach(mod => {
        Array.from(mod.tarefas).sort().forEach(tar => {
          colunas.push({ modulo: mod.nome, numero: mod.numero, tarefa: tar });
        });
      });

      setTarefasMapeadas(colunas);
      setEntregas(setEntregasTemp);
      setLoading(false);
    });

    return () => { unsubAlunos(); unsubAtividades(); };
  }, []);
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors"><ArrowLeft size={24} /></Link>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="text-blue-600" /> Mapa de Entregas Realistas
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-20 text-blue-600 font-bold animate-pulse">Sincronizando matriz de entregas...</div>
        ) : (
          <>
            {/* ========================================================
                VISÃO DESKTOP/TABLET (Tabela Matriz)
                Visível apenas em telas médias e grandes (md:block)
            ======================================================== */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-100 text-gray-600 uppercase font-bold text-xs">
                  <tr>
                    <th className="px-6 py-4 border-b border-gray-200 sticky left-0 bg-gray-100 z-10 shadow-md">Aluno</th>
                    {tarefasMapeadas.map((t, i) => (
                      <th key={i} className="px-4 py-4 text-center border-l border-b border-gray-200 whitespace-nowrap bg-gray-50">
                        <div className="text-[9px] text-gray-400 mb-0.5">{t.modulo}</div>
                        <div className="text-gray-700">{t.tarefa}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alunos.map((aluno, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-800 whitespace-nowrap sticky left-0 bg-white z-10 shadow-sm">{aluno}</td>
                      {tarefasMapeadas.map((t, j) => {
                        const entregou = entregas.has(`${aluno}-${t.numero}-${t.tarefa}`);
                        return (
                          <td key={j} className="px-4 py-4 text-center border-l border-gray-100">
                            {entregou ? (
                              <div className="inline-flex bg-green-100 text-green-600 p-1.5 rounded-full shadow-sm" title="Resposta Identificada">
                                <Check size={16} strokeWidth={3}/>
                              </div>
                            ) : (
                              <div className="inline-flex bg-red-50 text-red-300 p-1.5 rounded-full" title="Pendente">
                                <X size={16} strokeWidth={3}/>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ========================================================
                VISÃO MOBILE (Cards de Alunos)
                Visível apenas em telas pequenas (block md:hidden)
            ======================================================== */}
            <div className="block md:hidden space-y-4 mt-2">
              <div className="bg-white p-4 border border-gray-200 rounded-2xl flex justify-between items-center shadow-sm">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Resumo Mobile</span>
                <div className="flex gap-3 text-[10px] font-black uppercase text-gray-500">
                  <span className="flex items-center gap-1"><Check className="text-green-500" size={14}/> Ok</span>
                  <span className="flex items-center gap-1"><X className="text-red-400" size={14}/> Pend</span>
                </div>
              </div>

              {alunos.map((aluno, i) => {
                const totalTarefas = tarefasMapeadas.length;
                const tarefasEntregues = tarefasMapeadas.filter(t => entregas.has(`${aluno}-${t.numero}-${t.tarefa}`)).length;
                const statusCard = tarefasEntregues === totalTarefas ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white';

                return (
                  <div key={i} className={`rounded-2xl shadow-sm border overflow-hidden ${statusCard}`}>
                    <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center gap-3">
                      <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 truncate">
                        <User size={16} className="text-blue-500 shrink-0"/>
                        <span className="truncate">{aluno}</span>
                      </h3>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${tarefasEntregues === totalTarefas ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                        {tarefasEntregues}/{totalTarefas}
                      </span>
                    </div>
                    
                    <div className="p-4 divide-y divide-gray-50">
                      {tarefasMapeadas.map((t, j) => {
                        const entregou = entregas.has(`${aluno}-${t.numero}-${t.tarefa}`);
                        return (
                          <div key={j} className="py-2.5 flex justify-between items-center gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">{t.modulo}</p>
                              <p className="text-xs font-bold text-gray-700 truncate">{t.tarefa}</p>
                            </div>
                            <div className="shrink-0">
                              {entregou ? (
                                <span className="inline-flex bg-green-100 text-green-600 p-1.5 rounded-full"><Check size={14} strokeWidth={3}/></span>
                              ) : (
                                <span className="inline-flex bg-red-50 text-red-400 p-1.5 rounded-full"><X size={14} strokeWidth={3}/></span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
