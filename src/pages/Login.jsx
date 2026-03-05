import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, GraduationCap } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [instituicao, setInstituicao] = useState(''); 
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, setEscolaSelecionada } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!instituicao) { return setError('Por favor, selecione uma instituição ou programa.'); }

    try {
      setError('');
      setLoading(true);
      await login(email, password);
      setEscolaSelecionada(instituicao); 
      navigate('/'); 
    } catch (err) {
      setError('Falha ao fazer login. Verifique seu e-mail e senha.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        
        <div className="text-center mb-8">
          <div className="bg-blue-600 text-white w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <GraduationCap size={32} />
          </div>
          <h2 className="text-3xl font-black text-gray-800 tracking-tight">Plataforma do Professor</h2>
          <p className="text-gray-500 mt-2 font-medium">Gestão Inteligente de Avaliações</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm font-bold shadow-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Instituição / Programa</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><GraduationCap className="h-5 w-5 text-gray-400" /></div>
              <select required className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 text-gray-400 rounded-xl focus:ring-2 focus:ring-blue-500 appearance-none" value={instituicao} onChange={(e) => setInstituicao(e.target.value)}>
                <option value="" disabled>Ex: Mais Médicos, USP...</option>
                <option value="Mais Médicos" className="text-gray-800">Mais Médicos (Programa Nacional)</option>
                <option value="USP" className="text-gray-800">USP - Universidade de São Paulo</option>
                <option value="UFPI" className="text-gray-800">UFPI - Universidade Federal do Piauí</option>
                <option value="Outra" className="text-gray-800">Outra Instituição...</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">E-mail Profissional</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-gray-400" /></div>
              <input type="email" required className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500" placeholder="nome@instituicao.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Senha de Acesso</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
              <input type="password" required className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-3 px-4 rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 disabled:opacity-50 transition-all shadow-lg mt-2">
            {loading ? 'Autenticando...' : 'Acessar Plataforma'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-gray-100 pt-6">
          <p className="text-sm font-medium text-gray-600">
            Ainda não tem acesso?{' '}
            <Link to="/cadastro" className="font-black text-blue-600 hover:text-blue-800 transition-colors">
              Crie sua conta aqui
            </Link>
          </p>
        </div>

      </div>
      <div className="fixed bottom-4 text-center w-full text-xs font-bold text-gray-400">Plataforma do Professor v3.0 &copy; {new Date().getFullYear()}</div>
    </div>
  );
}
