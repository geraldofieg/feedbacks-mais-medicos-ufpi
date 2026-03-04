import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Check, X, ClipboardList } from 'lucide-react';

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

// Extrator blindado de números
const extractNum = (nome) => {
  if (!nome) return 0;
  const match = nome.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
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
      const ativs = snap.docs.map(doc => doc.data()).filter(a => isModuloValido(a.modulo));
      
      const setEntregasTemp = new Set();
      const modulosMap = {};
      let maxNumDB = 0;

      // Mapeia o que já tem no banco
      ativs.forEach(a => {
        const num = extractNum(a.modulo);
        if (num > maxNumDB) maxNumDB = num;

        // Normalização blindada: Salva a entrega usando o número do módulo
        if (a.aluno && a.aluno.toLowerCase() !== 'enunciado') {
          setEntregasTemp.add(`${a.aluno}-${num}-${a.tarefa}`);
        }
        
        if (!modulosMap[num]) modulosMap[num] = { nome: a.modulo, numero: num, tarefas: new Set() };
        modulosMap[num].tarefas.add(a.tarefa);
      });

      // --- A MÁGICA: INJETANDO AS COLUNAS DO CRONOGRAMA OFICIAL ---
      const moduloAtualIndex = cronogramaAssincrono.findIndex(m => getStatusData(m.inicio, m.fim) === 'atual');
      const moduloAtual = moduloAtualIndex !== -1 ? cronogramaAssincrono[moduloAtualIndex] : null;

      const numeroAlvoPrincipal = moduloAtual ? extractNum(moduloAtual.modulo) : maxNumDB;
      const numsAlvo = [numeroAlvoPrincipal, numeroAlvoPrincipal - 1].filter(n => n >= 7);

      // Garante que o Atual e o Anterior existam na tabela, mesmo sem notas
      numsAlvo.forEach(numAlvo => {
        const cronoMod = cronogramaAssincrono.find(m => extractNum(m.modulo) === numAlvo);
        const nomeLabel = cronoMod ? cronoMod.modulo : `Módulo ${numAlvo}`;

        if (!modulosMap[numAlvo]) {
          modulosMap[numAlvo] = { nome: nomeLabel, numero: numAlvo, tarefas: new Set() };
        }

        // Adiciona as tarefas oficiais (Desafio e Fórum) nas colunas
        const tarefasOficiais = cronoMod?.tarefas || [`M${numAlvo < 10 ? '0'+numAlvo : numAlvo}-Desafio`, `M${numAlvo < 10 ? '0'+numAlvo : numAlvo}-Fórum`];
        tarefasOficiais.forEach(t => modulosMap[numAlvo].tarefas.add(t));
      });

      // Transforma o Map em array e ordena (Maior módulo na esquerda)
      const listaMod = Object.values(modulosMap).sort((a, b) => b.numero - a.numero);
      
      const colunas = [];
      listaMod.forEach(mod => {
        // Ordena as tarefas alfabeticamente (Desafio antes de Fórum)
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
            <ClipboardList className="text-blue-600" /> Mapa de Entregas Recentes
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-20 text-blue-600 font-bold animate-pulse">Desenhando mapa...</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-600 uppercase font-bold text-xs">
                <tr>
                  <th className="px-6 py-4 rounded-tl-2xl border-b border-gray-200">Aluno</th>
                  {tarefasMapeadas.map((t, i) => (
                    <th key={i} className="px-4 py-4 text-center border-l border-b border-gray-200 whitespace-nowrap bg-gray-50">
                      <div className="text-[10px] text-gray-400 mb-0.5">{t.modulo}</div>
                      <div className="text-gray-700">{t.tarefa}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alunos.map((aluno, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-orange-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-800 whitespace-nowrap">{aluno}</td>
                    {tarefasMapeadas.map((t, j) => {
                      // Verifica o cruzamento de dados usando a regra normalizada (número exato)
                      const entregou = entregas.has(`${aluno}-${t.numero}-${t.tarefa}`);
                      return (
                        <td key={j} className="px-4 py-4 text-center border-l border-gray-100">
                          {entregou ? (
                            <div className="inline-flex bg-green-100 text-green-600 p-1.5 rounded-full shadow-sm" title="Entregue">
                              <Check size={16}/>
                            </div>
                          ) : (
                            <div className="inline-flex bg-red-50 text-red-400 p-1.5 rounded-full shadow-sm" title="Pendente">
                              <X size={16}/>
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
        )}
      </div>
    </div>
  );
}
