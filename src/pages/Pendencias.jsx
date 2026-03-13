import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../services/firebase';
import { ArrowLeft, AlertTriangle, User, Calendar, CalendarClock } from 'lucide-react';

export default function Pendencias() {
  const [pendencias, setPendencias] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPendencias() {
      setLoading(true);

      try {
        // 1. Busca os Alunos e cria o dicionário de tradução V3 -> V1
        const alunosSnap = await getDocs(collection(db, 'alunos'));
        const alunosMap = {};
        const alunosAtivos = [];
        
        alunosSnap.docs.forEach(doc => {
          const data = doc.data();
          // CORREÇÃO 1: Ignora os "Alunos Fantasmas" que estão na lixeira da V3
          if (data.status !== 'lixeira') {
            alunosAtivos.push(data.nome);
            alunosMap[doc.id] = data.nome; // Guarda o ID para traduzir a V3
          }
        });

        if (alunosAtivos.length === 0) {
          setLoading(false);
          return;
        }

        // 2. Busca Tarefas (V3) para o dicionário de tradução de Nomes
        const tarefasSnap = await getDocs(collection(db, 'tarefas'));
        const tarefasMap = {};
        tarefasSnap.docs.forEach(doc => {
          tarefasMap[doc.id] = doc.data().nomeTarefa;
        });

        // 3. Busca a Estrutura de Unidades (Módulos da V1)
        const modulosSnap = await getDocs(collection(db, 'modulos'));
        const modulosDB = modulosSnap.docs.map(doc => doc.data());

        const modulosAtivos = modulosDB
          .filter(mod => mod.status !== 'arquivado')
          .sort((a, b) => {
            const timeA = a.dataFim?.toMillis ? a.dataFim.toMillis() : (a.dataCriacao?.toMillis ? a.dataCriacao.toMillis() : 0);
            const timeB = b.dataFim?.toMillis ? b.dataFim.toMillis() : (b.dataCriacao?.toMillis ? b.dataCriacao.toMillis() : 0);
            return timeB - timeA; 
          });

        if (modulosAtivos.length === 0) {
          setPendencias([]);
          setLoading(false);
          return;
        }

        // 4. Busca as Atividades Entregues (últimos 90 dias)
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - 90);
        const qAtividades = query(collection(db, 'atividades'), where('dataCriacao', '>=', dataLimite));
        
        const atividadesSnap = await getDocs(qAtividades);
        const entregas = new Set();
        
        // CORREÇÃO 2: Unifica o Padrão V1 e V3 no mesmo Set
        atividadesSnap.docs.forEach(doc => {
          const a = doc.data();
          let nomeAluno = a.aluno; // Se foi feito na V1
          let nomeTarefa = a.tarefa; // Se foi feito na V1

          // Se foi feito na V3, traduz o ID para Nome
          if (a.alunoId && alunosMap[a.alunoId]) {
            nomeAluno = alunosMap[a.alunoId];
          }
          if (a.tarefaId && tarefasMap[a.tarefaId]) {
            nomeTarefa = tarefasMap[a.tarefaId];
          }

          if (nomeAluno && nomeTarefa) {
            // Guarda a assinatura "NomeDoAluno-NomeDaTarefa"
            entregas.add(`${nomeAluno}-${nomeTarefa}`);
          }
        });

        // 5. Cruza os alunos com as tarefas oficiais
        const resultado = [];
        
        modulosAtivos.forEach(mod => {
          const tarefasDoModulo = mod.tarefas || [];
          
          tarefasDoModulo.forEach(tar => {
            // Verifica se o aluno entregou aquela tarefa específica (ignora o nome do módulo agora)
            const devedores = alunosAtivos.filter(al => !entregas.has(`${al}-${tar}`));
            if (devedores.length > 0) {
              resultado.push({ 
                modulo: mod.nome, 
                tarefa: tar, 
                devedores: devedores.sort((a, b) => a.localeCompare(b)),
                dataFim: mod.dataFim 
              });
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
  }, []); 

  const getStatusPrazo = (timestampFim) => {
    if (!timestampFim || !timestampFim.toDate) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataFim = timestampFim.toDate();
    const diferencaTime = dataFim.getTime() - hoje.getTime();
    const dias = Math.ceil(diferencaTime / (1000 * 3600 * 24));
    
    return {
      dataFormatada: dataFim.toLocaleDateString('pt-BR'),
      diasRestantes: dias,
      vencido: dias < 0
    };
  };

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
          <div className="text-center py-20 text-orange-500 font-bold animate-pulse">
            Cruzando dados e calculando prazos...
          </div>
        ) : pendencias.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl text-center border-2 border-dashed border-green-200 text-green-600 font-bold shadow-sm">
            Uau! Nenhuma pendência nas unidades ativas. Todo mundo em dia! 🎉
          </div>
        ) : (
          <div className="space-y-6">
            {pendencias.map((item, idx) => {
              const status = getStatusPrazo(item.dataFim);

              return (
                <div key={idx} className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="bg-red-50 p-4 border-b border-red-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="text-red-500 shrink-0" size={24} />
                      <div>
                        <h3 className="font-black text-red-900 leading-tight">{item.modulo}</h3>
                        <p className="text-sm font-bold text-red-700">{item.tarefa}</p>
                      </div>
                    </div>
                    
                    <div className="shrink-0">
                      {status ? (
                        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${status.vencido ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}`}>
                          <CalendarClock size={14} /> 
                          {status.vencido ? `Vencido em ${status.dataFormatada}` : `Vence em ${status.dataFormatada}`}
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-gray-100 text-gray-500 border border-gray-200">
                          <CalendarClock size={14} /> Sem prazo definido
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4 bg-white">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                      Alunos Pendentes ({item.devedores.length})
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {item.devedores.map((aluno, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 p-2.5 rounded-lg border border-gray-200 transition-colors">
                          <User size={16} className="text-gray-400"/> {aluno}
                        </div>
                      ))}
                    </div>
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
