import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login'; 
import Dashboard from './pages/Dashboard'; 
import NovaAtividade from './pages/NovaAtividade'; 
import RevisarAtividade from './pages/RevisarAtividade';
import Alunos from './pages/Alunos'; // <-- Importando a página nova

function RotaPrivada({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<RotaPrivada><Dashboard /></RotaPrivada>} />
          <Route path="/nova-atividade" element={<RotaPrivada><NovaAtividade /></RotaPrivada>} />
          <Route path="/revisar/:id" element={<RotaPrivada><RevisarAtividade /></RotaPrivada>} />
          
          {/* A rota dos alunos */}
          <Route path="/alunos" element={<RotaPrivada><Alunos /></RotaPrivada>} />
          
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
