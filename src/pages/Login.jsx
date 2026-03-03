import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GraduationCap, LogIn, UserPlus } from 'lucide-react';

export default function Login() {
  // Controle de Tela: Login vs Cadastro
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Campos do Formulário
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Avisos e Carregamento
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isRegistering) {
        // Rota de Cadastro
        await signup(email, password, nome, whatsapp);
        setSuccess('Cadastro realizado! Verifique sua caixa de e-mail (e spam) para ativar a conta.');
        setIsRegistering(false); // Volta a tela para o modo de Login
        setNome(''); setWhatsapp(''); setPassword(''); // Limpa as senhas
      } else {
        // Rota de Login
        await login(email, password);
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      if (isRegistering) {
        setError('Erro ao criar conta. O e-mail já pode estar em uso ou a senha tem menos de 6 caracteres.');
      } else {
        setError('Falha ao fazer login. Verifique seu e-mail e senha.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 transition-all">
        
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <GraduationCap size={40} />
          </div>
          <h1 className="text-2xl font-black text-indigo-900">Plataforma do Professor</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isRegistering ? 'Crie sua conta gratuitamente' : 'Acesse seu painel de gestão'}
          </p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold text-center mb-6 border border-red-100">{error}</div>}
        {success && <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm font-bold text-center mb-6 border border-green-200 bg-green-50">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Campos exclusivos do Cadastro */}
          {isRegistering && (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome Completo</label>
                <input type="text" required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={nome} onChange={e => setNome(e.target.value)} placeholder="Prof. João da Silva" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">WhatsApp</label>
                <input type="tel" required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </>
          )}

          {/* Campos comuns (Email e Senha) */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">E-mail</label>
            <input type="email" required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Senha</label>
            <input type="password" required minLength="6" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          <button disabled={loading} className="w-full bg-indigo-600 text-white font-black py-3 rounded-lg hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2 mt-4 disabled:opacity-50">
            {isRegistering ? (
              <><UserPlus size={20} /> {loading ? 'Criando Conta...' : 'Criar Minha Conta'}</>
            ) : (
              <><LogIn size={20} /> {loading ? 'Entrando...' : 'Entrar na Plataforma'}</>
            )}
          </button>
        </form>
        
        {/* O botão do Flip */}
        <div className="mt-8 text-center border-t border-gray-100 pt-6">
          <p className="text-sm text-gray-600">
            {isRegistering ? 'Já possui uma conta?' : 'Ainda não é cadastrado?'}
          </p>
          <button 
            type="button"
            onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccess(''); }} 
            className="mt-2 text-indigo-600 font-bold hover:text-indigo-800 transition-colors text-sm"
          >
            {isRegistering ? 'Faça login aqui' : 'Crie sua conta gratuitamente'}
          </button>
        </div>

      </div>
    </div>
  );
}
