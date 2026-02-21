import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login'; 

function RotaPrivada({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

// O Dashboard provisório continua aqui só até criarmos a tela dele
const Dashboard = () => (
  <div className="p-8 bg-gray-100 min-h-screen">
    <h1 className="text-2xl font-bold text-green-600">Dashboard em construção...</h1>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
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
