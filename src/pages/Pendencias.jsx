import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, AlertTriangle, User, Calendar } from 'lucide-react';

// A REGRA DE OURO
const isModuloValido = (nome) => {
  if (!nome) return false;
  const lower = nome.toLowerCase();
  if (lower.includes('recupera')) return false;
  const match = lower.match(/\d+/);
  if (match && parseInt(match[0], 10) < 7) return false;
  return true; 
};

export default function Pendencias() {
  const [pendencias, setPendencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alunosAtivos, setAlunosAtivos] = useState([]);

  useEffect(() => {
    const unsubAlunos = onSnapshot(collection(db, 'alunos'), (snap) => {
      setAlunosAtivos(snap.docs.map(doc => doc.data().nome));
    });

    const unsubAtividades = onSnapshot(collection(db, 'atividades'), (snap) => {
      const atividades = snap.docs.map(doc => doc.data());
      
      // Filtra apenas os módulos válidos (7 em diante)
      const validAtiv = atividades.filter(a => isModuloValido(a.modulo));
      const entregas = new Set(validAtiv.map(a => `${a.aluno}-${a.modulo}-${a.tarefa}`));

      // Agrupa módulos e acha a data mais recente de cada um
      const modulosMap = {};
      validAtiv.forEach(a => {
        if (!modulosMap[a.modulo]) modulosMap[a.modulo] = { nome: a.modulo, data: 0, tarefas: new Set() };
        if (a.dataCriacao?.seconds > modulosMap[a.modulo].data) modulosMap[a.modulo].data = a.dataCriacao.seconds;
        modulosMap[a.modulo].tarefas.add(a.tarefa);
      });

      // Ordena módulos do mais recente para o mais antigo
      const listaMod = Object.values(modulosMap).sort((a, b) => b.data - a.data);

      const resultado = [];
      listaMod.forEach(mod => {
        mod.tarefas.forEach(tar => {
          const devedores = alunosAtivos.filter(al => !entregas.has(`${al}-${mod.nome}-${tar}`));
          if (devedores.length > 0) {
            resultado.push({ modulo: mod.nome, tarefa: tar, devedores });
          }
        });
      });

      setPendencias(resultado);
      setLoading(false);
    });

    return () => { unsubAlunos(); unsubAtividades(); };
  }, [alunosAtivos]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-orange-500 transition-colors"><ArrowLeft size={24} /></Link>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="text-orange-500" /> Relatório de Pendências
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-20 text-orange-500 font-bold">Processando devedores...</div>
        ) : pendencias.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl text-center border-2 border-dashed border-green-200 text-green-600 font-bold">
            Uau! Nenhuma pendência nos módulos recentes.
          </div>
        ) : (
          <div className="space-y-6">
            {pendencias.map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
                <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3">
                  <Calendar className="text-red-500" size={20} />
                  <div>
                    <h3 className="font-bold text-red-900">{item.modulo}</h3>
                    <p className="text-sm font-medium text-red-700">{item.tarefa}</p>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Alunos Pendentes ({item.devedores.length})</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {item.devedores.map((aluno, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <User size={14} className="text-gray-400"/> {aluno}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
