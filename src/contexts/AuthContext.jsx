import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // A MÁGICA: Agora o sistema guarda um Objeto { id: '...', nome: '...' }
  const [escolaSelecionada, setEscolaSelecionadaState] = useState(() => {
    const stored = localStorage.getItem('@SaaS_EscolaSelecionada');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        // Se encontrar o formato antigo (apenas texto), ele limpa para forçar o novo padrão
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    escolaSelecionada,
    setEscolaSelecionada,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
