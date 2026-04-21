import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// COMPONENTES
import Navbar from './components/Navbar';
import BotaoGlobal from './components/BotaoGlobal'; 

// PÁGINAS PÚBLICAS
import Login from './pages/Login';
import Signup from './pages/Signup';

// PÁGINAS PRIVADAS (SaaS V3)
import Dashboard from './pages/Dashboard';
import Turmas from './pages/Turmas';
import Tarefas from './pages/Tarefas'; 
import Cronograma from './pages/Cronograma';
import Comunicacao from './pages/Comunicacao';
import RevisarAtividade from './pages/RevisarAtividade';
import Alunos from './pages/Alunos';
import Configuracoes from './pages/Configuracoes';
import MapaEntregas from './pages/MapaEntregas';
import Pendencias from './pages/Pendencias';
import Lixeira from './pages/Lixeira'; 
import Migracao from './pages/Migracao'; 
import Planos from './pages/Planos'; 
import Guia from './pages/Guia'; 

// ESTEIRA DE PRODUÇÃO (KANBAN)
import AguardandoRevisao from './pages/AguardandoRevisao';
import FaltaPostar from './pages/FaltaPostar'; 
import Historico from './pages/Historico';

// PAINEL DE GESTÃO DO CEO
import Admin from './pages/Admin'; 

// PÁGINA DE BLOQUEIO DO SAAS
import AssinaturaVencida from './pages/AssinaturaVencida';

// PORTAL DO SUPERVISOR
import SupervisorLogin from './pages/supervisor/SupervisorLogin';
import SupervisorCadastro from './pages/supervisor/SupervisorCadastro';
import SupervisorPainel from './pages/supervisor/SupervisorPainel';

const VERSAO_LOCAL_APP = 1;

// SEGURANÇA DA PORTA PARA SUPERVISORES
function PrivateRouteSupervisor({ children }) {
  const { currentUser, loading, userProfile } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Carregando...</div>;
  if (!currentUser) return <Navigate to="/supervisor/login" />;
  if (userProfile && userProfile.role !== 'supervisor') return <Navigate to="/supervisor/login" />;
  return children;
}

// O NOSSO "SEGURANÇA DA PORTA" ATUALIZADO PARA O SAAS
function PrivateRoute({ children, permiteVencido = false }) {
  const { currentUser, loading, isAcessoExpirado, isSuperAdmin } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Carregando...</div>;
  
  // 1. Não tem login? Vai pro Login.
  if (!currentUser) return <Navigate to="/login" />;

  // 2. Tá logado, mas a assinatura venceu? Vai pra página de cobrança!
  // (O Super Admin e a própria tela de aviso estão isentos dessa regra)
  if (isAcessoExpirado && !isSuperAdmin && !permiteVencido) {
    return <Navigate to="/assinatura-vencida" />;
  }

  // 3. Tá tudo certo? Pode entrar.
  return children;
}

function App() {
  useEffect(() => {
    const intervalId = setInterval(() => {
      const configRef = doc(db, 'sistema', 'config');
      getDoc(configRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.versaoAtiva > VERSAO_LOCAL_APP) {
              window.location.reload(true);
            }
          }
        })
        .catch((error) => {
          console.warn('Erro ao verificar versão do app:', error);
        });
    }, 600000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <Router>
      <AuthProvider>
        <Navbar /> 
        
        <Routes>
          {/* ROTAS PÚBLICAS */}
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Signup />} />
          
          {/* ROTA DE BLOQUEIO (Única rota privada que permite usuário vencido) */}
          <Route path="/assinatura-vencida" element={<PrivateRoute permiteVencido={true}><AssinaturaVencida /></PrivateRoute>} />
          
          {/* ROTAS PRIVADAS DO SISTEMA */}
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/turmas" element={<PrivateRoute><Turmas /></PrivateRoute>} />
          <Route path="/tarefas" element={<PrivateRoute><Tarefas /></PrivateRoute>} />
          <Route path="/cronograma" element={<PrivateRoute><Cronograma /></PrivateRoute>} />
          <Route path="/comunicacao" element={<PrivateRoute><Comunicacao /></PrivateRoute>} />
          <Route path="/revisar/:id" element={<PrivateRoute><RevisarAtividade /></PrivateRoute>} />
          <Route path="/alunos" element={<PrivateRoute><Alunos /></PrivateRoute>} />
          <Route path="/configuracoes" element={<PrivateRoute><Configuracoes /></PrivateRoute>} />
          <Route path="/mapa" element={<PrivateRoute><MapaEntregas /></PrivateRoute>} />
          <Route path="/pendencias" element={<PrivateRoute><Pendencias /></PrivateRoute>} />
          <Route path="/planos" element={<PrivateRoute><Planos /></PrivateRoute>} />
          <Route path="/guia" element={<PrivateRoute><Guia /></PrivateRoute>} /> 
          
          {/* ROTAS DE UTILIDADE */}
          <Route path="/lixeira" element={<PrivateRoute><Lixeira /></PrivateRoute>} />
          <Route path="/migracao" element={<PrivateRoute><Migracao /></PrivateRoute>} /> 
          
          {/* ROTAS DO KANBAN (Esteira de Produção V3) */}
          <Route path="/aguardandorevisao" element={<PrivateRoute><AguardandoRevisao /></PrivateRoute>} />
          <Route path="/faltapostar" element={<PrivateRoute><FaltaPostar /></PrivateRoute>} />
          <Route path="/historico" element={<PrivateRoute><Historico /></PrivateRoute>} />
          
          {/* Rota do Painel SaaS */}
          <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
          
          {/* ── ROTAS DO PORTAL DO SUPERVISOR (sem Navbar, sem PrivateRoute de professor) ── */}
          <Route path="/supervisor/login" element={<SupervisorLogin />} />
          <Route path="/supervisor/cadastro" element={<SupervisorCadastro />} />
          <Route path="/supervisor/painel" element={
            <PrivateRouteSupervisor><SupervisorPainel /></PrivateRouteSupervisor>
          } />
          <Route path="/supervisor" element={<Navigate to="/supervisor/login" />} />

          {/* Rota de fallback */}
          <Route path="*" element={<Navigate to="/" />} />
          
        </Routes>

        <BotaoGlobal />

      </AuthProvider>
    </Router>
  );
}

export default App;
