import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Esse é o "segurança da porta": só deixa entrar no sistema quem estiver logado
function RotaPrivada({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

// Telas provisórias (vamos criar as telas reais e bonitas no próximo passo!)
const Login = () => (
  <div className="flex h-screen items-center justify-center bg-gray-100">
    <h1 className="text-2xl font-bold text-blue-600">Tela de Login em construção...</h1>
  </div>
);

const Dashboard = () => (
  <div className="p-8 bg-gray-100 min-h-screen">
    <h1 className="text-2xl font-bold text-green-600">Dashboard da Patrícia em construção...</h1>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Qualquer um que tentar acessar a raiz (/) tem que passar pela RotaPrivada */}
          <Route 
            path="/" 
            element={
              <RotaPrivada>
                <Dashboard />
              </RotaPrivada>
            } 
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
