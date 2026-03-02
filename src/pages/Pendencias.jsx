import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore'; // REMOVIDO onSnapshot, ADD getDocs
import { db } from '../services/firebase';
import { ArrowLeft, AlertTriangle, User, Calendar } from 'lucide-react';
import { cronogramaAssincrono } from '../data/cronogramaData'; // IMPORTANDO O CALENDÁRIO OFICIAL

// A REGRA DE OURO MANTIDA
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

  useEffect(() => {
    async function fetchPendencias() {
      setLoading(true);

      try {
        // 1. Busca os Alunos (Leitura Única e Barata)
        const alunosSnap = await getDocs(collection(db, 'alunos'));
        const alunosAtivos = alunosSnap.docs.map(doc => doc.data().nome);

        if (alunosAtivos.length === 0) {
          setLoading(false);
          return;
        }

        // 2. Busca as Atividades Entregues (Leitura Única)
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - 90);
        const qAtividades = query(collection(db, 'atividades'), where('dataCriacao', '>=', dataLimite));
        
        const atividadesSnap = await getDocs(qAtividades);
        const atividadesBrutas = atividadesSnap.docs.map(doc => doc.data());

        // 3. Filtra apenas os módulos válidos (7 em diante) e cria a "lista de presença"
        const validAtiv = atividadesBrutas.filter(a => isModuloValido(a.modulo));
        const entregas = new Set(validAtiv.map(a => `${a.aluno}-${a.modulo}-${a.tarefa}`));

        // 4. A CIRURGIA: Cria o mapa de tarefas a partir do CRONOGRAMA, e não das entregas!
        const modulosMap = {};
        const moduloCount = 1; // Só pra criar um "tempo falso" para ordenação decrescente
        let ordemModulos = cronogramaAssincrono.length;

        cronogramaAssincrono.forEach(item => {
          if (isModuloValido(item.modulo)) {
             modulosMap[item.modulo] = {
               nome: item.modulo,
               data: ordemModulos--, // Garante que o Módulo 8 (fim da lista) tenha peso maior
               tarefas: new Set(item.tarefas) // Puxa TODAS as tarefas oficiais, mesmo as vazias
             };
          }
        });

        // Ordena módulos do maior (Módulo 8) para o menor (Módulo 7)
        const listaMod = Object.values(modulosMap).sort((a, b) => b.data - a.data);

        // 5. Cruza os alunos com o cronograma oficial
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
      } catch (error) {
        console.error("Erro ao buscar pendências:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPendencias();
  }, []); // Trava do useEffect para rodar apenas uma vez na montagem

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
