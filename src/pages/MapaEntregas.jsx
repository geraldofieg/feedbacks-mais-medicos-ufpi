import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Check, X, ClipboardList } from 'lucide-react';

const isModuloValido = (nome) => {
  if (!nome) return false;
  const lower = nome.toLowerCase();
  if (lower.includes('recupera')) return false;
  const match = lower.match(/\d+/);
  if (match && parseInt(match[0], 10) < 7) return false;
  return true; 
};

export default function MapaEntregas() {
  const [alunos, setAlunos] = useState([]);
  const [tarefasMapeadas, setTarefasMapeadas] = useState([]);
  const [entregas, setEntregas] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAlunos = onSnapshot(collection(db, 'alunos'), (snap) => {
      setAlunos(snap.docs.map(doc => doc.data().nome).sort());
    });

    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 90);
    const qAtividades = query(collection(db, 'atividades'), where('dataCriacao', '>=', dataLimite));

    const unsubAtividades = onSnapshot(qAtividades, (snap) => {
      const ativs = snap.docs.map(doc => doc.data()).filter(a => isModuloValido(a.modulo));
      
      const setEntregasTemp = new Set();
      const modulosMap = {};

      ativs.forEach(a => {
        setEntregasTemp.add(`${a.aluno}-${a.modulo}-${a.tarefa}`);
        if (!modulosMap[a.modulo]) modulosMap[a.modulo] = { nome: a.modulo, data: 0, tarefas: new Set() };
        if (a.dataCriacao?.seconds > modulosMap[a.modulo].data) modulosMap[a.modulo].data = a.dataCriacao.seconds;
        modulosMap[a.modulo].tarefas.add(a.tarefa);
      });

      // Ordena módulos do mais recente pro mais antigo
      const listaMod = Object.values(modulosMap).sort((a, b) => b.data - a.data);
      
      const colunas = [];
      listaMod.forEach(mod => {
        Array.from(mod.tarefas).sort().forEach(tar => {
          colunas.push({ modulo: mod.nome, tarefa: tar });
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
          <div className="text-center py-20 text-blue-600 font-bold">Gerando mapa...</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-600 uppercase font-bold text-xs">
                <tr>
                  <th className="px-6 py-4 rounded-tl-2xl">Aluno</th>
                  {tarefasMapeadas.map((t, i) => (
                    <th key={i} className="px-4 py-4 text-center border-l border-gray-200 whitespace-nowrap">
                      <div className="text-[10px] text-gray-400">{t.modulo}</div>
                      <div>{t.tarefa}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alunos.map((aluno, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-gray-800 whitespace-nowrap">{aluno}</td>
                    {tarefasMapeadas.map((t, j) => {
                      const entregou = entregas.has(`${aluno}-${t.modulo}-${t.tarefa}`);
                      return (
                        <td key={j} className="px-4 py-4 text-center border-l border-gray-100">
                          {entregou ? (
                            <div className="inline-flex bg-green-100 text-green-600 p-1.5 rounded-full"><Check size={16}/></div>
                          ) : (
                            <div className="inline-flex bg-red-100 text-red-400 p-1.5 rounded-full"><X size={16}/></div>
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
