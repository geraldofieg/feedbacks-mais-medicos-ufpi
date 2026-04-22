import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { Lock, Mail, Stethoscope, AlertTriangle } from 'lucide-react';

export default function SupervisorLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'usuarios', cred.user.uid));
      const perfil = snap.data();

      // Se não tem perfil, bloqueia
      if (!perfil) {
        await auth.signOut();
        setError('Conta não encontrada. Tente novamente.');
        setLoading(false);
        return;
      }

      // Se já é supervisor — acesso normal
      // Se é professor — concede acesso duplo (supervisorAccess: true)
      // Qualquer outro role desconhecido — bloqueia
      if (perfil.role !== 'supervisor' && perfil.role !== 'professor') {
        await auth.signOut();
        setError('Esta conta não tem permissão para acessar o portal do supervisor.');
        setLoading(false);
        return;
      }

      // Professor tentando acessar pela primeira vez → concede acesso de supervisor
      if (perfil.role === 'professor' && !perfil.supervisorAccess) {
        await updateDoc(doc(db, 'usuarios', cred.user.uid), {
          supervisorAccess: true,
          supervisorTrialInicio: new Date(),
          supervisorDataExpiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }

      // Atualiza último acesso
      await updateDoc(doc(db, 'usuarios', cred.user.uid), {
        ultimoAcesso: serverTimestamp(),
        emailVerificado: cred.user.emailVerified,
      });

      console.log('[SupervisorLogin] acesso liberado — role:', perfil.role, 'supervisorAccess:', perfil.supervisorAccess);
      setTimeout(() => navigate('/supervisor/painel'), 400);
    } catch (err) {
      console.error('[SupervisorLogin] erro:', err.code, err.message);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos. Verifique e tente novamente.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Sem conexão com a internet. Verifique sua rede.');
      } else {
        setError(`Erro inesperado: ${err.code || err.message}. Tente novamente ou entre em contato.`);
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">

        <div className="text-center mb-8">
          <div className="bg-blue-600 text-white w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <Stethoscope size={30} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Portal do Supervisor</h2>
          <p className="text-gray-500 mt-1 font-medium text-sm">Mais Médicos — Preenchimento Automático</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm font-bold">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="email" required autoComplete="username"
                className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="seu@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="password" required autoComplete="current-password"
                className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white font-black py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg"
          >
            {loading ? 'Autenticando...' : 'Entrar no Portal'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-gray-100 pt-6">
          <p className="text-sm font-medium text-gray-600">
            Ainda não tem acesso?{' '}
            <Link to="/supervisor/cadastro" className="font-black text-blue-600 hover:text-blue-800">
              Solicite aqui
            </Link>
          </p>
        </div>
      </div>

      <div className="fixed bottom-4 text-center w-full text-xs font-bold text-gray-400">
        Portal do Supervisor — Plataforma do Professor © {new Date().getFullYear()}
      </div>
    </div>
  );
}
