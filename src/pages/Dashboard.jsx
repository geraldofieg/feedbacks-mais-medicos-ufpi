import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, PlusCircle, Users, LayoutDashboard, Clock, CheckCircle, ChevronRight, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function Dashboard() {
  const { logout, currentUser, userRole } = useAuth();
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'atividades'), orderBy('dataCriacao', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listaAtividades = [];
      snapshot.forEach((doc) => {
        listaAtividades.push({ id: doc.id, ...doc.data() });
      });
      setAtividades(listaAtividades);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const atividadesPendentes = atividades.filter(a => a.status === 'pendente');

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Cabeçalho */}
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-blue-800">Mais Médicos UFPI</h1>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full mt-1 inline-block font-medium">
            {userRole === 'admin' ? 'Administrador' : 'Aprovadora'}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden md:block font-medium">
            {currentUser?.email}
          </span>
          <button onClick={() => logout()} className="flex items-center gap-2 text-red-500 hover:text-red-700 font-bold transition-colors">
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </nav>

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        
        {/* PRIORIDADE 1: Mesa de Trabalho da Patrícia (O que precisa ser feito AGORA) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Clock className="text-orange-500" />
              Aguardando Revisão
              <span className="bg-orange-100 text-orange-800 text-xs py-1 px-2 rounded-full">
                {atividadesPendentes.length}
              </span>
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Buscando atividades...</div>
            ) : atividadesPendentes.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center justify-center gap-3">
                <div className="bg-green-50 p-4 rounded-full">
                  <CheckCircle size={40} className="text-green-500" />
                </div>
                <p className="text-lg font-bold text-gray-700">Tudo em dia!</p>
                <p className="text-gray-500 text-center">Não há nenhuma atividade pendente de revisão no momento.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {atividadesPendentes.map((atividade) => (
                  <div key={atividade.id} className="p-4 md:p-6 hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{atividade.aluno}</h3>
                      <p className="text-sm text-gray-600 font-medium mt-1">{atividade.modulo}</p>
                    </div>
                    
                    <Link 
                      to={`/revisar/${atividade.id}`} 
                      className="flex items-center justify-center gap-2 bg-blue-50 text-blue-700 px-5 py-3 rounded-lg font-bold hover:bg-blue-600 hover:text-white transition-all w-full md:w-auto"
                    >
                      Revisar Agora
                      <ChevronRight size={18} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* PRIORIDADE 2: Menu de Acesso Rápido (Ferramentas e Cadastros) */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 mt-8">
            <LayoutDashboard className="text-blue-600" />
            Ferramentas do Sistema
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Botão Nova Atividade */}
            <Link to="/nova-atividade" className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col items-center justify-center gap-3 group">
              <div className="bg-blue-50 p-4 rounded-full group-hover:bg-blue-100 transition-colors">
                <PlusCircle size={32} className="text-blue-600" />
              </div>
              <span className="font-bold text-gray-700">Cadastrar Atividade</span>
            </Link>

            {/* Botão Mapa de Entregas (Nossa próxima meta) */}
            <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center gap-3 opacity-70 cursor-not-allowed">
              <div className="bg-gray-200 p-4 rounded-full">
                <ClipboardList size={32} className="text-gray-500" />
              </div>
              <span className="font-bold text-gray-500 text-center">Mapa de Entregas<br/><span className="text-xs font-normal">(Em desenvolvimento)</span></span>
            </div>

            {/* Botão Gerenciar Turma (Baixa prioridade, deixado por último) */}
            <Link to="/alunos" className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col items-center justify-center gap-3 group">
              <div className="bg-gray-50 p-4 rounded-full group-hover:bg-gray-200 transition-colors">
                <Users size={32} className="text-gray-600" />
              </div>
              <span className="font-bold text-gray-700">Gerenciar Turma</span>
            </Link>

          </div>
        </section>

      </main>
    </div>
  );
}
