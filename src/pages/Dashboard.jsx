import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  PlusCircle, 
  ClipboardList, 
  Users, 
  Settings, 
  LogOut, 
  CheckCircle, 
  Clock,
  Calendar
} from 'lucide-react';

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pendentes: 0, aprovados: 0 });
  const [ultimaData, setUltimaData] = useState(null);

  useEffect(() => {
    // Busca estatísticas
    const q = query(collection(db, 'atividades'));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => doc.data());
      setStats({
        pendentes: docs.filter(d => d.status === 'pendente').length,
        aprovados: docs.filter(d => d.status === 'aprovado').length
      });
    });

    // Busca a data da ÚLTIMA atividade cadastrada (em qualquer status)
    const qUltima = query(
      collection(db, 'atividades'), 
      orderBy('dataCriacao', 'desc'), 
      limit(1)
    );
    
    const unsubUltima = onSnapshot(qUltima, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data().dataCriacao?.toDate();
        if (data) {
          const formatada = data.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          setUltimaData(formatada);
        }
      }
    });

    return () => { unsub(); unsubUltima(); };
  }, []);

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header com Barra de Atualização */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
          <h1 className="text-xl font-bold text-gray-800">Painel de Controle</h1>
          
          {ultimaData && (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium border border-blue-100">
              <Calendar size={16} />
              <span>Última atualização: {ultimaData}</span>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Aguardando Revisão</p>
              <h3 className="text-3xl font-black text-yellow-600">{stats.pendentes}</h3>
            </div>
            <div className="bg-yellow-100 p-3 rounded-xl text-yellow-600"><Clock size={32} /></div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Feedbacks Aprovados</p>
              <h3 className="text-3xl font-black text-green-600">{stats.aprovados}</h3>
            </div>
            <div className="bg-green-100 p-3 rounded-xl text-green-600"><CheckCircle size={32} /></div>
          </div>
        </div>

        {/* Menu Principal */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Link to="/nova-atividade" className="bg-blue-600 text-white p-6 rounded-2xl shadow-md hover:bg-blue-700 transition-all flex flex-col items-center gap-3 text-center">
            <PlusCircle size={32} />
            <span className="font-bold">Nova Atividade</span>
          </Link>

          <Link to="/mapa" className="bg-white text-gray-700 p-6 rounded-2xl shadow-sm border border-gray-200 hover:border-blue-500 transition-all flex flex-col items-center gap-3 text-center">
            <ClipboardList size={32} className="text-blue-600" />
            <span className="font-bold">Mapa de Entregas</span>
          </Link>

          <Link to="/alunos" className="bg-white text-gray-700 p-6 rounded-2xl shadow-sm border border-gray-200 hover:border-blue-500 transition-all flex flex-col items-center gap-3 text-center">
            <Users size={32} className="text-blue-600" />
            <span className="font-bold">Alunos</span>
          </Link>

          <Link to="/configuracoes" className="bg-white text-gray-700 p-6 rounded-2xl shadow-sm border border-gray-200 hover:border-blue-500 transition-all flex flex-col items-center gap-3 text-center">
            <Settings size={32} className="text-gray-500" />
            <span className="font-bold">Configurações</span>
          </Link>

          <button onClick={handleLogout} className="bg-red-50 text-red-600 p-6 rounded-2xl shadow-sm border border-red-100 hover:bg-red-100 transition-all flex flex-col items-center gap-3 text-center">
            <LogOut size={32} />
            <span className="font-bold">Sair</span>
          </button>
        </div>
      </main>
    </div>
  );
}
