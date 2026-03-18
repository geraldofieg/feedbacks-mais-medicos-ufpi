import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase'; 
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
// Importamos setDoc e serverTimestamp para criar novos usuários
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

  function signup(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
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
            // Usuário já existe, apenas carrega o perfil
            setUserProfile(docSnap.data());
          } else {
            // NOVO USUÁRIO: Criando o perfil com 30 dias de Trial
            const dataExpiracao = new Date();
            dataExpiracao.setDate(dataExpiracao.getDate() + 30); // Soma 30 dias

            const novoPerfil = {
              email: user.email,
              role: 'professor', // Papel padrão
              plano: 'trial',
              dataCriacao: serverTimestamp(),
              dataExpiracao: dataExpiracao, // Salva o limite de acesso
              isVitalicio: false
            };

            await setDoc(docRef, novoPerfil);
            
            // Busca novamente para garantir que o formato de data (Timestamp) venha certinho do Firebase
            const novoSnap = await getDoc(docRef);
            setUserProfile(novoSnap.data());
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

  // 🔥 SEGURANÇA PROFISSIONAL: Agora o Super Admin é identificado apenas pelo cargo no banco de dados
  const isSuperAdmin = userProfile?.role === 'admin';

  if (!isSuperAdmin && userProfile) {
    if (userProfile.isVitalicio === true) {
      isAcessoExpirado = false; // Tem passe livre comprado
    } else if (userProfile.dataExpiracao) {
      // Verifica se a data de hoje é maior que a data de expiração
      const dataVencimento = userProfile.dataExpiracao.toDate ? userProfile.dataExpiracao.toDate() : new Date(userProfile.dataExpiracao);
      const hoje = new Date();
      if (hoje > dataVencimento) {
        isAcessoExpirado = true; // Venceu!
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
    isAcessoExpirado, // Exportando a trava para o App.jsx usar
    isSuperAdmin // Facilita identificar o dono em qualquer tela via banco de dados
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
