import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, CheckCheck, Send, Trash2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, userProfile, escolaSelecionada, setEscolaSelecionada } = useAuth();
  const isAdmin = currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';
  const planoUsuario = userProfile?.plano || 'basico'; 
  const mostrarRevisao = isAdmin || planoUsuario === 'intermediario' || planoUsuario === 'premium';
  
  const [instituicoes, setInstituicoes] = useState([]);
  const [kanban, setKanban] = useState({ pendentes: 0, faltaLancar: 0, finalizados: 0 });
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
  }, [currentUser, escolaSelecionada, setEscolaSelecionada]);

  // 2. Busca os Números Reais das 3 Caixas
  useEffect(() => {
    async function fetchDados() {
      if (!escolaSelecionada?.id) return;
      setKanban({ pendentes: 0, faltaLancar: 0, finalizados: 0 }); 
      
      const qAtiv = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
      const snap = await getDocs(qAtiv);
      
      let p = 0, f = 0, ok = 0;
      snap.docs.forEach(doc => {
        const d = doc.data();
        if (d.postado === true) {
          ok++; // Caixa Verde (Histórico Finalizado)
        } else if (d.status === 'aprovado') {
          f++;  // Caixa Azul (Aguardando Postar)
        } else {
          p++;  // Caixa Amarela (Aguardando Revisão)
        }
      });
      setKanban({ pendentes: p, faltaLancar: f, finalizados: ok });
    }
    fetchDados();
  }, [escolaSelecionada]);

  if (loading) return <div className="p-20 text-center font-bold">Carregando Estação...</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-800">Centro de Comando</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-bold text-gray-400">Instituição:</span>
            <select className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg border-none outline-none cursor-pointer shadow-inner" 
              value={escolaSelecionada?.id} 
              onChange={e => setEscolaSelecionada(instituicoes.find(i => i.id === e.target.value))}
            >
              {instituicoes.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* AS 3 CAIXAS DO KANBAN */}
      <div className={`grid grid-cols-1 gap-6 ${mostrarRevisao ? 'md:grid-cols-3' : 'md:grid-cols-2 max-w-4xl'}`}>
        
        {/* CAIXA AMARELA: Aguardando Revisão */}
        {mostrarRevisao && (
          <div className="bg-white border-2 border-yellow-200 p-8 rounded-3xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xs font-black text-yellow-600 uppercase tracking-widest">Aguardando Revisão</h3>
              <div className="bg-yellow-50 p-2 rounded-lg"><Clock className="text-yellow-500" size={24}/></div>
            </div>
            <span className="text-6xl font-black text-gray-800">{kanban.pendentes}</span>
            <Link to="/aguardandorevisao" className="mt-6 text-xs font-bold text-yellow-600 flex items-center gap-1 hover:underline">
              Ver lista <ChevronRight size={14}/>
            </Link>
          </div>
        )}

        {/* CAIXA AZUL: Aguardando Postar */}
        <div className="bg-white border-2 border-blue-200 p-8 rounded-3xl shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest">Aguardando Postar</h3>
            <div className="bg-blue-50 p-2 rounded-lg"><Send className="text-blue-500" size={24}/></div>
          </div>
          <span className="text-6xl font-black text-gray-800">{kanban.faltaLancar}</span>
          <Link to="/faltapostar" className="mt-6 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">
            Copiar p/ Site <ChevronRight size={14}/>
          </Link>
        </div>

        {/* CAIXA VERDE: Histórico Finalizado */}
        <div className="bg-white border-2 border-green-200 p-8 rounded-3xl shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xs font-black text-green-600 uppercase tracking-widest">Histórico Finalizado</h3>
            <div className="bg-green-50 p-2 rounded-lg"><CheckCheck className="text-green-500" size={24}/></div>
          </div>
          <span className="text-6xl font-black text-gray-800">{kanban.finalizados}</span>
          <Link to="/historico" className="mt-6 text-xs font-bold text-green-600 flex items-center gap-1 hover:underline">
            Ver histórico <ChevronRight size={14}/>
          </Link>
        </div>

      </div>
    </div>
  );
}
