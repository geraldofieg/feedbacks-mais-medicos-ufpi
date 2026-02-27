import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar'; // NOVO: Importação do nosso menu
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NovaAtividade from './pages/NovaAtividade';
import RevisarAtividade from './pages/RevisarAtividade';
import Alunos from './pages/Alunos';
import Configuracoes from './pages/Configuracoes';
import MapaEntregas from './pages/MapaEntregas';
import ListaAtividades from './pages/ListaAtividades';
import Pendencias from './pages/Pendencias';
import Cronograma from './pages/Cronograma';
import Comunicacao from './pages/Comunicacao';

function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  return currentUser ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        {/* NOVO: A Navbar fica solta aqui, aparecendo no topo de todas as rotas */}
        <Navbar /> 
        
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/cronograma" element={<PrivateRoute><Cronograma /></PrivateRoute>} />
          <Route path="/comunicacao" element={<PrivateRoute><Comunicacao /></PrivateRoute>} />
          <Route path="/nova-atividade" element={<PrivateRoute><NovaAtividade /></PrivateRoute>} />
          <Route path="/revisar/:id" element={<PrivateRoute><RevisarAtividade /></PrivateRoute>} />
          <Route path="/alunos" element={<PrivateRoute><Alunos /></PrivateRoute>} />
          <Route path="/configuracoes" element={<PrivateRoute><Configuracoes /></PrivateRoute>} />
          <Route path="/mapa" element={<PrivateRoute><MapaEntregas /></PrivateRoute>} />
          <Route path="/lista/:status" element={<PrivateRoute><ListaAtividades /></PrivateRoute>} />
          <Route path="/pendencias" element={<PrivateRoute><Pendencias /></PrivateRoute>} />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
