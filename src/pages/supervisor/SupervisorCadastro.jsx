import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { Lock, Mail, User, Phone, Stethoscope, CheckCircle2, AlertTriangle } from 'lucide-react';
import emailjs from '@emailjs/browser';

export default function SupervisorCadastro() {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) return setError('As senhas não coincidem.');
    if (password.length < 6) return setError('Senha mínima de 6 caracteres.');
    setError(''); setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);

      // Trial de 30 dias automático
      const expiracao = new Date();
      expiracao.setDate(expiracao.getDate() + 30);

      await setDoc(doc(db, 'usuarios', cred.user.uid), {
        uid: cred.user.uid,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp.trim(),
        role: 'supervisor',          // 🔒 sempre supervisor — nunca professor
        plano: 'trial',
        dataExpiracao: expiracao,
        isVitalicio: false,
        status: 'ativo',
        emailVerificado: false,
        ultimoAcesso: null,
        tourVisto: false,
        dataCriacao: serverTimestamp(),
      });

      // Alerta para você via EmailJS (mesmo serviço do professor)
      emailjs.send('service_jv9cfcm', 'template_jjcg2s9', {
        nome: `[SUPERVISOR] ${nome}`,
        email,
        whatsapp: whatsapp || 'Não informado',
      }, 'eGRPATDfiYt45_hS-').catch(console.error);

      setSuccess(true);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado — possivelmente na Plataforma do Professor. Vá para a tela de login do Portal do Supervisor e entre com o mesmo e-mail e senha. O acesso será liberado automaticamente.');
      } else {
        setError('Erro ao criar conta. Tente novamente.');
      }
    } finally { setLoading(false); }
  }

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
        <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-2xl font-black text-gray-800 mb-4">Quase lá, Supervisor(a)!</h2>
        <p className="text-gray-600 font-medium mb-4">
          Enviamos um link de confirmação para:
          <strong className="block mt-2 bg-gray-50 border border-gray-200 p-2 rounded-lg text-gray-900">{email}</strong>
        </p>
        <p className="text-sm text-gray-500 mb-8">
          Confirme o e-mail e em seguida acesse o portal. Seu trial de <strong>30 dias</strong> já está ativo.
        </p>
        <Link to="/supervisor/login" className="inline-block bg-blue-600 text-white font-black px-8 py-3 rounded-xl hover:bg-blue-700 transition-all">
          Ir para o Login
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">

        <div className="text-center mb-8">
          <div className="bg-blue-600 text-white w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <Stethoscope size={30} />
          </div>
          <h2 className="text-2xl font-black text-gray-800">Criar conta de Supervisor</h2>
          <p className="text-gray-500 mt-1 text-sm font-medium">30 dias gratuitos · sem cartão de crédito</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm font-bold">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Nome completo', icon: User, value: nome, set: setNome, type: 'text', ph: 'Dr. João Silva' },
            { label: 'WhatsApp', icon: Phone, value: whatsapp, set: setWhatsapp, type: 'text', ph: '63 99999-0000' },
            { label: 'E-mail', icon: Mail, value: email, set: setEmail, type: 'email', ph: 'seu@email.com', auto: 'username' },
            { label: 'Senha', icon: Lock, value: password, set: setPassword, type: 'password', ph: '••••••••', auto: 'new-password' },
            { label: 'Confirmar senha', icon: Lock, value: confirm, set: setConfirm, type: 'password', ph: '••••••••', auto: 'new-password' },
          ].map(({ label, icon: Icon, value, set, type, ph, auto }) => (
            <div key={label}>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">{label}</label>
              <div className="relative">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={type} required autoComplete={auto}
                  className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder={ph} value={value} onChange={e => set(e.target.value)}
                />
              </div>
            </div>
          ))}
          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white font-black py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg mt-2"
          >
            {loading ? 'Criando conta...' : 'Criar conta gratuita'}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-gray-100 pt-5">
          <p className="text-sm font-medium text-gray-600">
            Já tem conta?{' '}
            <Link to="/supervisor/login" className="font-black text-blue-600 hover:text-blue-800">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
