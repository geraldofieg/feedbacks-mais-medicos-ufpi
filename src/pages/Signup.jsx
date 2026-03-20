import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase'; 
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; 

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); 
  const [loading, setLoading] = useState(true);

  // Guarda o Objeto { id: '...', nome: '...' } da Instituição
  const [escolaSelecionada, setEscolaSelecionadaState] = useState(() => {
    const stored = localStorage.getItem('@SaaS_EscolaSelecionada');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null; 
      }
    }
    return null;
  });

  function setEscolaSelecionada(escolaObj) {
    if (!escolaObj) {
      setEscolaSelecionadaState(null);
      localStorage.removeItem('@SaaS_EscolaSelecionada');
    } else {
      setEscolaSelecionadaState(escolaObj);
      localStorage.setItem('@SaaS_EscolaSelecionada', JSON.stringify(escolaObj));
    }
  }

  // 🔥 FUNÇÃO DE CADASTRO TURBINADA (Agora salva Nome, Zap e acende o Sininho)
  async function signup(email, password, nome, whatsapp) {
    // 1. Cria a conta de acesso (Authentication)
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Define os 30 dias de Trial
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 30);

    // 3. Monta a ficha completa do professor
    const novoPerfil = {
      nome: nome,
      whatsapp: whatsapp || '',
      email: user.email,
      role: 'professor',
      plano: 'trial',
      dataCriacao: serverTimestamp(),
      dataExpiracao: dataExpiracao,
      isVitalicio: false,
      vistoPeloAdmin: false // 🔥 ISSO AQUI ACENDE O SEU SININHO LÁ NO NAVBAR!
    };

    // 4. Salva a ficha no Banco de Dados IMEDIATAMENTE
    await setDoc(doc(db, 'usuarios', user.uid), novoPerfil);
    
    // Atualiza o sistema com os dados recém-criados
    setUserProfile(novoPerfil);

    return userCredential;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    setEscolaSelecionada(null); 
    setUserProfile(null); 
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const docRef = doc(db, 'usuarios', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          } else {
            // Pequeno "delay" caso o banco de dados atrase milissegundos na criação
            setTimeout(async () => {
              const retrySnap = await getDoc(docRef);
              if (retrySnap.exists()) setUserProfile(retrySnap.data());
            }, 1500);
          }
        } catch (error) {
          console.error("Erro ao buscar perfil SaaS do usuário:", error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // --- AVALIAÇÃO DE BLOQUEIO DO SAAS ---
  let isAcessoExpirado = false;
  const isSuperAdmin = userProfile?.role === 'admin';

  if (!isSuperAdmin && userProfile) {
    if (userProfile.isVitalicio === true) {
      isAcessoExpirado = false; 
    } else if (userProfile.dataExpiracao) {
      const dataVencimento = userProfile.dataExpiracao.toDate ? userProfile.dataExpiracao.toDate() : new Date(userProfile.dataExpiracao);
      const hoje = new Date();
      if (hoje > dataVencimento) {
        isAcessoExpirado = true; 
      }
    }
  }

  const value = {
    currentUser,
    userProfile, 
    login,
    signup,
    logout,
    escolaSelecionada,
    setEscolaSelecionada,
    isAcessoExpirado, 
    isSuperAdmin 
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
