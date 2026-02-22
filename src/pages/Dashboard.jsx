import { useAuth } from '../contexts/AuthContext';
import { LogOut, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { logout, currentUser, userRole } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Cabeçalho Superior */}
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-blue-800">Mais Médicos UFPI</h1>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full mt-1 inline-block">
            {userRole === 'admin' ? 'Administrador' : 'Aprovador'}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden md:block">
            {currentUser?.email}
          </span>
          <button onClick={() => logout()} className="flex items-center gap-2 text-red-500 hover:text-red-700 font-medium transition-colors">
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </nav>

      {/* Área Principal */}
      <main className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Visão Geral</h2>
          
          {/* Botão de Nova Atividade (Aparece mais para o Admin) */}
          <Link to="/nova-atividade" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            <PlusCircle size={20} />
            Nova Atividade
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600">
            Ainda não há atividades listadas aqui. Que tal cadastrar a primeira?
          </p>
        </div>
      </main>
    </div>
  );
}
