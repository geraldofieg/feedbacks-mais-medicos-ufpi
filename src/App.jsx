import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import BotaoGlobal from './components/BotaoGlobal'; // NOVO: Import do Botão Global
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Turmas from './pages/Turmas';
import Tarefas from './pages/Tarefas'; 
import NovaAtividade from './pages/NovaAtividade';
import RevisarAtividade from './pages/RevisarAtividade';
import Alunos from './pages/Alunos';
import Configuracoes from './pages/Configuracoes';
import MapaEntregas from './pages/MapaEntregas';
import ListaAtividades from './pages/ListaAtividades';
import Pendencias from './pages/Pendencias';
import Cronograma from './pages/Cronograma';
import Comunicacao from './pages/Comunicacao';
import FaltaPostar from './pages/FaltaPostar'; // NOVO: Import da tela de Falta Postar

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
          <Route path="/nova-atividade" element={<PrivateRoute><NovaAtividade /></PrivateRoute>} />
          <Route path="/revisar/:id" element={<PrivateRoute><RevisarAtividade /></PrivateRoute>} />
          <Route path="/alunos" element={<PrivateRoute><Alunos /></PrivateRoute>} />
          <Route path="/configuracoes" element={<PrivateRoute><Configuracoes /></PrivateRoute>} />
          <Route path="/mapa" element={<PrivateRoute><MapaEntregas /></PrivateRoute>} />
          <Route path="/lista/:status" element={<PrivateRoute><ListaAtividades /></PrivateRoute>} />
          <Route path="/pendencias" element={<PrivateRoute><Pendencias /></PrivateRoute>} />
          
          {/* NOVO: Rota da tela de Falta Postar */}
          <Route path="/faltapostar" element={<PrivateRoute><FaltaPostar /></PrivateRoute>} />
          
          {/* Rota de fallback: Se digitar uma URL que não existe, volta pro Dashboard */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        {/* NOVO: Botão Flutuante Global renderizado por cima de tudo */}
        <BotaoGlobal />

      </AuthProvider>
    </Router>
  );
}

export default App;
