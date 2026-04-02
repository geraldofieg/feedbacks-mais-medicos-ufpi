import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, User, Phone, GraduationCap, CheckCircle2, ArrowLeft } from 'lucide-react';
import emailjs from '@emailjs/browser'; 

export default function Signup() {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false); 
  
  const { signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      return setError('As senhas não coincidem. Tente novamente.');
    }

    if (password.length < 6) {
      return setError('A senha deve ter pelo menos 6 caracteres.');
    }

    try {
      setError('');
      setLoading(true);
      
      // Chama a função para criar a conta no Firebase
      await signup(email, password, nome, whatsapp);
      
      // 🔥 DISPARO DO EMAILJS JÁ COM AS SUAS CHAVES:
      emailjs.send(
        'service_jv9cfcm', 
        'template_jjcg2s9', 
        {
          nome: nome,
          email: email,
          whatsapp: whatsapp || 'Não informado'
        },
        'eGRPATDfiYt45_hS-' 
      ).then(() => {
        console.log('Alerta enviado!');
      }).catch((error) => {
        console.error('Erro no alerta:', error);
      });
      
      setSuccess(true);
      
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado em nossa base.');
      } else {
        setError('Falha ao criar conta. Verifique os dados e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
          <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-4">Quase lá, Professor(a)!</h2>
          <p className="text-gray-600 mb-8 font-medium">
            Enviamos um link de confirmação para a sua segurança no e-mail: <br/>
            <strong className="text-gray-900 block mt-2 border border-gray-200 bg-gray-50 p-2 rounded-lg">{email}</strong>
            <br/>
            Por favor, clique no link enviado para validar que você é humano e liberar seu acesso à plataforma.
          </p>
          <Link to="/login" className="w-full bg-gray-100 text-gray-700 font-bold py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors block border border-gray-200">
            Voltar para o Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 py-10">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        
        <div className="text-center mb-8">
          <div className="bg-blue-600 text-white w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <GraduationCap size={32} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Crie sua Conta</h2>
          <p className="text-gray-500 mt-2 text-sm font-medium">Junte-se à Plataforma do Professor</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm font-bold shadow-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Nome Completo</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className="h-5 w-5 text-gray-400" /></div>
              <input type="text" required className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500" placeholder="Ex: Prof. João Silva" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">WhatsApp (com DDD)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Phone className="h-5 w-5 text-gray-400" /></div>
              <input type="tel" required className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500" placeholder="63999999999" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">E-mail Profissional</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-gray-400" /></div>
              <input type="email" required className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500" placeholder="nome@instituicao.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><Lock className="h-4 w-4 text-gray-400" /></div>
                <input type="password" required minLength="6" className="w-full pl-8 pr-2 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Confirmar Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><Lock className="h-4 w-4 text-gray-400" /></div>
                <input type="password" required minLength="6" className="w-full pl-8 pr-2 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white font-black py-3 px-4 rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 disabled:opacity-50 transition-all transform hover:-translate-y-0.5 mt-4 shadow-lg"
          >
            {loading ? 'Cadastrando...' : 'Criar minha conta'}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-gray-100 pt-6">
          <Link to="/login" className="text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2">
            <ArrowLeft size={16}/> Já tenho uma conta (Fazer Login)
          </Link>
        </div>

      </div>
    </div>
  );
}
