import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendEmailVerification // 🔥 ESSENCIAL PARA O E-MAIL DO PROFESSOR
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'; 

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [escolaSelecionada, setEscolaSelecionadaState] = useState(() => {
    const stored = localStorage.getItem('@SaaS_EscolaSelecionada');
    return stored ? JSON.parse(stored) : null;
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

  // 🔥 FUNÇÃO MESTRA: Cadastra, envia e-mail e marca para o Sininho
  async function signup(email, password, nome, whatsapp) {
    // 1. Cria o acesso
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. ENVIA O E-MAIL DE VERIFICAÇÃO (O que estava faltando!)
    try {
      await sendEmailVerification(user);
    } catch (e) {
      console.error("Erro ao enviar e-mail de verificação:", e);
    }

    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 30);

    // 3. Salva a ficha completa no Banco (Nome, Zap e Sininho)
    const novoPerfil = {
      nome: nome,
      whatsapp: whatsapp || '',
      email: user.email,
      role: 'professor',
      plano: 'trial',
      dataCriacao: serverTimestamp(),
      dataExpiracao: dataExpiracao,
      isVitalicio: false,
      vistoPeloAdmin: false, // 🔥 ISSO ATIVA O SININHO
      emailVerificado: false, // 🔥 NOVO: Nasce como falso
      ultimoAcesso: null      // 🔥 NOVO: Nasce sem acesso
    };
    await setDoc(doc(db, 'usuarios', user.uid), novoPerfil);
    setUserProfile(novoPerfil);

    return userCredential;
  }

  async function login(email, password) { 
    // 1. Faz o login no motor do Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Tática de Auto-Cura: Atualiza a ficha do professor no banco de dados
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), {
        ultimoAcesso: serverTimestamp(),
        emailVerificado: user.emailVerified // Pega a verdade absoluta do Firebase Auth
      });
    } catch (error) {
      console.error("Erro ao registrar último acesso:", error);
    }

    return userCredential;
  }

  function logout() { setEscolaSelecionada(null); setUserProfile(null); return signOut(auth); }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const docRef = doc(db, 'usuarios', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          }
        } catch (error) {
          console.error("Erro ao buscar perfil:", error);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const isSuperAdmin = userProfile?.role === 'admin' || currentUser?.email === 'geraldofieg@gmail.com';
  let isAcessoExpirado = false;

  if (!isSuperAdmin && userProfile) {
    if (userProfile.isVitalicio !== true && userProfile.dataExpiracao) {
      const dataVencimento = userProfile.dataExpiracao.toDate ?
        userProfile.dataExpiracao.toDate() : new Date(userProfile.dataExpiracao);
      if (new Date() > dataVencimento) isAcessoExpirado = true;
    }
  }

  const value = {
    currentUser, userProfile, login, signup, logout,
    escolaSelecionada, setEscolaSelecionada, isAcessoExpirado, isSuperAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
