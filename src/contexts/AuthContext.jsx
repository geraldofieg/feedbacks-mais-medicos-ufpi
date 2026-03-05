import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ==========================================
  // O CORAÇÃO DO SAAS: MEMÓRIA DA ESCOLA ATIVA
  // ==========================================
  const [escolaSelecionada, setEscolaSelecionadaState] = useState(() => {
    // Quando o site abre, ele verifica se o professor já tinha escolhido uma escola na última visita
    return localStorage.getItem('@SaaS_EscolaSelecionada') || '';
  });

  // Função inteligente que atualiza o sistema e salva no cache do navegador (Evita perder a escolha no F5)
  const setEscolaSelecionada = (escolaId) => {
    if (escolaId) {
      localStorage.setItem('@SaaS_EscolaSelecionada', escolaId);
    } else {
      localStorage.removeItem('@SaaS_EscolaSelecionada');
    }
    setEscolaSelecionadaState(escolaId);
  };

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    setEscolaSelecionada(''); // Limpa a memória da faculdade por segurança ao sair
    return signOut(auth);
  }

  // Cadastro completo (SaaS)
  async function signup(email, password, nome, whatsapp) {
    // 1. Cria a conta no cofre de senhas do Google
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Coloca o nome no perfil do Google
    await updateProfile(user, { displayName: nome });

    // 3. Dispara o e-mail de verificação de segurança
    await sendEmailVerification(user);

    // 4. Salva o WhatsApp e os dados no nosso banco de dados (Firestore)
    await setDoc(doc(db, 'usuarios', user.uid), {
      nome: nome,
      email: email,
      whatsapp: whatsapp,
      role: 'professor',
      dataCadastro: serverTimestamp()
    });

    // 5. Desloga o usuário imediatamente para obrigá-lo a verificar o e-mail
    await signOut(auth);

    return user;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    login,
    signup, 
    logout,
    escolaSelecionada, // Exportado para o Dashboard e Mapa saberem qual escola filtrar
    setEscolaSelecionada // Exportado para a tela de Login e Navbar poderem mudar a faculdade
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
