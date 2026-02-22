import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login'; 
import Dashboard from './pages/Dashboard'; 
import NovaAtividade from './pages/NovaAtividade'; // <-- Aqui dizemos ao sistema que esta página existe

function RotaPrivada({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rota Pública */}
          <Route path="/login" element={<Login />} />
          
          {/* Rotas Privadas (só entra se tiver feito login) */}
          <Route 
            path="/" 
            element={
              <RotaPrivada>
                <Dashboard />
              </RotaPrivada>
            } 
          />
          
          <Route 
            path="/nova-atividade" 
            element={
              <RotaPrivada>
                <NovaAtividade />
              </RotaPrivada>
            } 
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
