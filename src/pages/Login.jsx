import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GraduationCap, LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Falha ao fazer login. Verifique seu e-mail e senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <GraduationCap size={40} />
          </div>
          <h1 className="text-2xl font-black text-indigo-900">Plataforma do Professor</h1>
          <p className="text-gray-500 text-sm mt-1">Acesse seu painel de gestão docente</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold text-center mb-6 border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">E-mail de Acesso</label>
            <input 
              type="email" 
              required 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Senha</label>
            <input 
              type="password" 
              required 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••"
            />
          </div>
          <button 
            disabled={loading} 
            className="w-full bg-indigo-600 text-white font-black py-3 rounded-lg hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2 mt-2 disabled:opacity-50"
          >
            <LogIn size={20} /> {loading ? 'Entrando...' : 'Entrar na Plataforma'}
          </button>
        </form>
        
      </div>
    </div>
  );
}
