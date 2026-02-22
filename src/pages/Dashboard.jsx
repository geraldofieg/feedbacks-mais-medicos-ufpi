import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';

export default function Dashboard() {
  const { logout, currentUser, userRole } = useAuth();

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      console.error("Erro ao sair do sistema", error);
    }
  }

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
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </nav>

      {/* Área Principal de Conteúdo */}
      <main className="p-6 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Visão Geral</h2>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600">
            A estrutura do seu painel está pronta! Logo colocaremos aqui os botões de cadastro de atividades e a lista de feedbacks para revisão.
          </p>
        </div>
      </main>
    </div>
  );
}
