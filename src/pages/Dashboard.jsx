import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, GraduationCap, CheckCheck, Clock, Building2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, userProfile, escolaSelecionada, setEscolaSelecionada } = useAuth();
  const [instituicoes, setInstituicoes] = useState([]);
  const [kanban, setKanban] = useState({ pendentes: 0, finalizados: 0 });
  const [loading, setLoading] = useState(true);

  // 1. Busca as Instituições Ativas
  useEffect(() => {
    async function fetchInst() {
      if (!currentUser) return;
      const q = query(collection(db, 'instituicoes'), where('professorUid', '==', currentUser.uid));
      const snap = await getDocs(q);
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.status !== 'lixeira');
      setInstituicoes(lista);
      if (lista.length > 0 && !escolaSelecionada) setEscolaSelecionada(lista[0]);
      setLoading(false);
    }
    fetchInst();
  }, [currentUser]);

  // 2. Busca os Números Reais (Sempre que trocar de escola)
  useEffect(() => {
    async function fetchDados() {
      if (!escolaSelecionada?.id) return;
      setKanban({ pendentes: 0, finalizados: 0 }); // Limpa antes de carregar novo
      
      const qAtiv = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
      const snap = await getDocs(qAtiv);
      
      let p = 0, f = 0;
      snap.docs.forEach(doc => {
        const d = doc.data();
        if (d.status === 'aprovado' || d.postado) f++;
        else p++;
      });
      setKanban({ pendentes: p, finalizados: f });
    }
    fetchDados();
  }, [escolaSelecionada]);

  if (loading) return <div className="p-20 text-center font-bold">Carregando Estação...</div>;

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-800">Centro de Comando</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-bold text-gray-400">Instituição:</span>
            <select className="bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-lg border-none outline-none cursor-pointer shadow-inner" 
              value={escolaSelecionada?.id} 
              onChange={e => setEscolaSelecionada(instituicoes.find(i => i.id === e.target.value))}
            >
              {instituicoes.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border-2 border-yellow-200 p-8 rounded-3xl shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xs font-black text-yellow-600 uppercase tracking-widest">Aguardando Revisão</h3>
            <Clock className="text-yellow-500" />
          </div>
          <span className="text-6xl font-black text-gray-800">{kanban.pendentes}</span>
        </div>

        <div className="bg-white border-2 border-green-200 p-8 rounded-3xl shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xs font-black text-green-600 uppercase tracking-widest">Finalizados (Migrados)</h3>
            <CheckCheck className="text-green-500" />
          </div>
          <span className="text-6xl font-black text-gray-800">{kanban.finalizados}</span>
        </div>
      </div>
    </div>
  );
}
