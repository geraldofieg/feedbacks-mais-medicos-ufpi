import { useAuth } from '../contexts/AuthContext';
import { LogOut, AlertOctagon, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AssinaturaVencida() {
  const { logout, userProfile } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  // Formatando a data que venceu (opcional, só para ficar mais amigável)
  let dataFmt = 'recentemente';
  if (userProfile?.dataExpiracao) {
    const d = userProfile.dataExpiracao.toDate ? userProfile.dataExpiracao.toDate() : new Date(userProfile.dataExpiracao);
    dataFmt = d.toLocaleDateString('pt-BR');
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center">
        
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertOctagon size={40} />
        </div>
        
        <h1 className="text-2xl font-black text-slate-800 mb-2">Período de Testes Encerrado</h1>
        
        <p className="text-slate-500 font-medium mb-8 leading-relaxed">
          Seu acesso gratuito de 30 dias expirou em <strong className="text-slate-700">{dataFmt}</strong>. 
          Todos os seus dados, alunos e feedbacks continuam salvos com segurança em nossos servidores.
        </p>
        
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-8 text-left flex items-start gap-4">
          <CreditCard className="text-blue-500 shrink-0 mt-1" size={24} />
          <div>
            <h3 className="font-bold text-blue-900 text-sm mb-1">Renove sua assinatura</h3>
            <p className="text-xs text-blue-700 font-medium leading-relaxed">
              Para recuperar o acesso imediato ao painel e à Inteligência Artificial, entre em contato com o suporte para realizar o pagamento da mensalidade.
            </p>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut size={20} /> Sair da Plataforma
        </button>

      </div>
    </div>
  );
}
