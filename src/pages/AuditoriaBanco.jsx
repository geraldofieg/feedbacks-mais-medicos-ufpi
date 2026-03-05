import { useState, useEffect } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ClipboardList, Copy, CheckCircle2 } from 'lucide-react';

export default function AuditoriaBanco() {
  const [relatorio, setRelatorio] = useState('Iniciando varredura no Firebase...');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    async function auditarBanco() {
      // Lista de coleções da V1 e as possíveis coleções antigas do SaaS
      const colecoes = ['alunos', 'modulos', 'atividades', 'enunciados', 'escolas', 'instituicoes', 'usuarios', 'users'];
      const resultadoFinal = {};

      for (const nomeCol of colecoes) {
        try {
          // Pega uma amostra de 15 documentos para mapear bem as colunas
          const q = query(collection(db, nomeCol), limit(15));
          const snap = await getDocs(q);

          if (snap.empty) {
            resultadoFinal[nomeCol] = "Coleção vazia ou inexistente no banco.";
            continue;
          }

          const campos = {};

          snap.forEach(doc => {
            const data = doc.data();
            Object.keys(data).forEach(key => {
              let tipoDado = typeof data[key];
              
              if (data[key] === null) tipoDado = 'null';
              else if (Array.isArray(data[key])) tipoDado = 'array';
              else if (typeof data[key] === 'object' && data[key].toDate) tipoDado = 'timestamp (data)';
              else if (typeof data[key] === 'object' && data[key].id) tipoDado = 'reference';

              if (!campos[key]) campos[key] = new Set();
              campos[key].add(tipoDado);
            });
          });

          resultadoFinal[nomeCol] = {};
          Object.keys(campos).sort().forEach(key => {
            resultadoFinal[nomeCol][key] = Array.from(campos[key]).join(' ou ');
          });

        } catch (error) {
          resultadoFinal[nomeCol] = `Erro de leitura: ${error.message}`;
        }
      }

      setRelatorio(JSON.stringify(resultadoFinal, null, 2));
    }

    auditarBanco();
  }, []);

  const handleCopiar = () => {
    navigator.clipboard.writeText(relatorio);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8 flex items-center justify-center font-mono">
      <div className="max-w-4xl w-full bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col">
        <div className="bg-gray-950 p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-green-400 font-bold flex items-center gap-2">
            <ClipboardList size={20} /> Raio-X do Firebase (SaaS V3)
          </h2>
          <button 
            onClick={handleCopiar}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
          >
            {copiado ? <><CheckCircle2 size={16}/> Copiado!</> : <><Copy size={16}/> Copiar Relatório</>}
          </button>
        </div>
        <div className="p-4 overflow-auto max-h-[70vh]">
          <pre className="text-gray-300 text-sm whitespace-pre-wrap">
            {relatorio}
          </pre>
        </div>
      </div>
    </div>
  );
}
