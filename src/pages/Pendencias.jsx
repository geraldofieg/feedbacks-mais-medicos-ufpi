import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, AlertTriangle, UserX, CheckCircle } from 'lucide-react';

export default function Pendencias() {
  const [alunos, setAlunos] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Busca todos os alunos em ordem alfabética
    const unsubAlunos = onSnapshot(query(collection(db, 'alunos'), orderBy('nome', 'asc')), (snap) => {
      setAlunos(snap.docs.map(doc => doc.data().nome));
    });

    // Busca todas as atividades para sabermos o que já foi entregue
    const unsubAtividades = onSnapshot(collection(db, 'atividades'), (snap) => {
      setAtividades(snap.docs.map(doc => doc.data()));
      setLoading(false);
    });

    return () => { unsubAlunos(); unsubAtividades(); };
  }, []);

  // Lógica de Agrupamento
  const agrupado = {};
  atividades.forEach(atv => {
    if (!agrupado[atv.modulo]) agrupado[atv.modulo] = {};
    if (!agrupado[atv.modulo][atv.tarefa]) agrupado[atv.modulo][atv.tarefa] = new Set();
    agrupado[atv.modulo][atv.tarefa].add(atv.aluno);
  });

  const modulosOrdenados = Object.keys(agrupado).sort();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-orange-600 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="text-orange-500" /> Relatório de Pendências
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-20 text-orange-600 font-medium">Analisando entregas...</div>
        ) : modulosOrdenados.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl text-center border-2 border-dashed border-gray-200 text-gray-500">
            Nenhuma atividade cadastrada no sistema ainda.
          </div>
        ) : (
          <div className="space-y-6">
            {modulosOrdenados.map(modulo => {
              const tarefasOrdenadas = Object.keys(agrupado[modulo]).sort();
              
              return (
                <div key={modulo} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-800 text-white p-4 font-black text-lg">
                    {modulo}
                  </div>
                  
                  <div className="divide-y divide-gray-100">
                    {tarefasOrdenadas.map(tarefa => {
                      const alunosQueEntregaram = agrupado[modulo][tarefa];
                      const faltam = alunos.filter(a => !alunosQueEntregaram.has(a));

                      return (
                        <div key={tarefa} className="p-5">
                          <h4 className="font-bold text-gray-700 text-md mb-3 border-b pb-2">{tarefa}</h4>
                          
                          {faltam.length === 0 ? (
                            <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 p-3 rounded-lg">
                              <CheckCircle size={20} /> Turma completa! Todos entregaram.
                            </div>
                          ) : (
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {faltam.map((alunoFalta, i) => (
                                <li key={i} className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg font-medium text-sm">
                                  <UserX size={16} /> {alunoFalta}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
