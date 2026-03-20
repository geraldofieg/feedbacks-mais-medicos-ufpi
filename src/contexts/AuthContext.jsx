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

  // 🔥 FUNÇÃO ATUALIZADA: Recebe nome e whatsapp e marca como NÃO VISTO
  async function signup(email, password, nome, whatsapp) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 30);

    const novoPerfil = {
      nome: nome,
      whatsapp: whatsapp || '',
      email: user.email,
      role: 'professor',
      plano: 'trial',
      dataCriacao: serverTimestamp(),
      dataExpiracao: dataExpiracao,
      isVitalicio: false,
      vistoPeloAdmin: false // 🔥 ISSO LIGA O SININHO
    };

    await setDoc(doc(db, 'usuarios', user.uid), novoPerfil);
    setUserProfile(novoPerfil);
    return userCredential;
  }

  function login(email, password) { return signInWithEmailAndPassword(auth, email, password); }
  function logout() { setEscolaSelecionada(null); setUserProfile(null); return signOut(auth); }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const docRef = doc(db, 'usuarios', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setUserProfile(docSnap.data());
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const isSuperAdmin = userProfile?.role === 'admin';
  let isAcessoExpirado = false;
  if (!isSuperAdmin && userProfile?.dataExpiracao && !userProfile.isVitalicio) {
    const dVenc = userProfile.dataExpiracao.toDate ? userProfile.dataExpiracao.toDate() : new Date(userProfile.dataExpiracao);
    if (new Date() > dVenc) isAcessoExpirado = true;
  }

  const value = { currentUser, userProfile, login, signup, logout, escolaSelecionada, setEscolaSelecionada, isAcessoExpirado, isSuperAdmin };
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
