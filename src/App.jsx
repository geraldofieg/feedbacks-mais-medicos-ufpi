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

// ESTEIRA DE PRODUÇÃO (KANBAN)
import AguardandoRevisao from './pages/AguardandoRevisao';
import FaltaPostar from './pages/FaltaPostar'; 
import Historico from './pages/Historico';

// PAINEL DE GESTÃO DO CEO - AGORA APONTANDO PARA O ARQUIVO CORRETO
import Admin from './pages/Admin'; 

function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  return currentUser ? children : <Navigate to="/login" />;
}

const VERSAO_LOCAL_APP = 1;

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
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Signup />} />
          
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
          
          {/* ROTAS DE UTILIDADE */}
          <Route path="/lixeira" element={<PrivateRoute><Lixeira /></PrivateRoute>} />
          <Route path="/migracao" element={<PrivateRoute><Migracao /></PrivateRoute>} /> 
          
          {/* ROTAS DO KANBAN (Esteira de Produção V3) */}
          <Route path="/aguardandorevisao" element={<PrivateRoute><AguardandoRevisao /></PrivateRoute>} />
          <Route path="/faltapostar" element={<PrivateRoute><FaltaPostar /></PrivateRoute>} />
          <Route path="/historico" element={<PrivateRoute><Historico /></PrivateRoute>} />
          
          {/* Rota do Painel SaaS - ATUALIZADA PARA USAR O COMPONENTE ADMIN */}
          <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
          
          {/* Rota de fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        <BotaoGlobal />

      </AuthProvider>
    </Router>
  );
}

export default App;
