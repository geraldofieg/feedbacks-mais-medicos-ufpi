import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase'; // Adicionado o 'db'
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; // Adicionado para ler o banco de dados

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // NOVO: Guarda o Plano e a Role do Firestore
  const [loading, setLoading] = useState(true);

  // A MÁGICA: Agora o sistema guarda um Objeto { id: '...', nome: '...' }
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

  // FUNÇÕES DE AUTENTICAÇÃO RESTAURADAS
  function signup(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    setEscolaSelecionada(null); // Limpa a instituição ao sair
    setUserProfile(null); // Limpa o perfil ao sair
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      // Quando loga, busca o Perfil SaaS no Firestore (Plano, Role, etc)
      if (user) {
        try {
          const docRef = doc(db, 'usuarios', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          } else {
            setUserProfile(null);
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

  const value = {
    currentUser,
    userProfile, // NOVO: Exportamos o perfil para usar no Dashboard!
    login,
    signup,
    logout,
    escolaSelecionada,
    setEscolaSelecionada,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
