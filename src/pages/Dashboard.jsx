import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
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
  Calendar,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pendentes: 0, aprovados: 0 });
  const [ultimaData, setUltimaData] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'atividades'), (snap) => {
      const docs = snap.docs.map(doc => doc.data());
      setStats({
        pendentes: docs.filter(d => d.status === 'pendente').length,
        aprovados: docs.filter(d => d.status === 'aprovado').length
      });
    });

    const qUltima = query(collection(db, 'atividades'), orderBy('dataCriacao', 'desc'), limit(1));
    const unsubUltima = onSnapshot(qUltima, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data().dataCriacao?.toDate();
        if (data) {
          setUltimaData(data.toLocaleDateString('pt-BR', { 
            day: '2-digit', month: '2-digit', year: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
          }));
        }
      }
    });

    return () => { unsub(); unsubUltima(); };
  }, []);

  async function handleLogout() {
    try { await logout(); navigate('/login'); } catch (e) { console.error(e); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
          <h1 className="text-xl font-bold text-gray-800">Mais Médicos UFPI</h1>
          {ultimaData && (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-bold border border-blue-100 self-start">
              <Calendar size={16} />
              <span>Sincronizado: {ultimaData}</span>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link to="/lista/pendente" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:bg-gray-50 active:scale-95 transition-all">
            <div>
              <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Aguardando Revisão</p>
              <h3 className="text-4xl font-black text-yellow-600">{stats.pendentes}</h3>
              <div className="flex items-center gap-1 text-blue-600 text-sm font-bold mt-2">
                Ver lista <ChevronRight size={16} />
              </div>
            </div>
            <div className="bg-yellow-100 p-4 rounded-2xl text-yellow-600"><Clock size={32} /></div>
          </Link>
          
          <Link to="/lista/aprovado" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:bg-gray-50 active:scale-95 transition-all">
            <div>
              <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Histórico Aprovado</p>
              <h3 className="text-4xl font-black text-green-600">{stats.aprovados}</h3>
              <div className="flex items-center gap-1 text-blue-600 text-sm font-bold mt-2">
                Ver histórico <ChevronRight size={16} />
              </div>
            </div>
            <div className="bg-green-100 p-4 rounded-2xl text-green-600"><CheckCircle size={32} /></div>
          </Link>
        </div>

        {/* Menu de Ações Rápidas - Agora com 6 botões */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Link to="/nova-atividade" className="bg-blue-600 text-white p-5 rounded-2xl shadow-lg flex flex-col items-center gap-2 text-center active:scale-95 transition-transform">
            <PlusCircle size={28} />
            <span className="font-bold text-sm">Nova Atividade</span>
          </Link>

          <Link to="/pendencias" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center active:scale-95 transition-transform">
            <AlertTriangle size={28} className="text-orange-500" />
            <span className="font-bold text-sm">Pendências</span>
          </Link>

          <Link to="/mapa" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center active:scale-95 transition-transform">
            <ClipboardList size={28} className="text-blue-600" />
            <span className="font-bold text-sm">Mapa</span>
          </Link>

          <Link to="/alunos" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center active:scale-95 transition-transform">
            <Users size={28} className="text-blue-600" />
            <span className="font-bold text-sm">Alunos</span>
          </Link>

          <Link to="/configuracoes" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center active:scale-95 transition-transform">
            <Settings size={28} className="text-gray-500" />
            <span className="font-bold text-sm">Config</span>
          </Link>

          <button onClick={handleLogout} className="bg-red-50 text-red-600 p-5 rounded-2xl border border-red-100 flex flex-col items-center gap-2 text-center active:scale-95 transition-transform">
            <LogOut size={28} />
            <span className="font-bold text-sm">Sair</span>
          </button>
        </div>
      </main>
    </div>
  );
}
