import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, PlusCircle, FileText, Clock, CheckCircle, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function Dashboard() {
  const { logout, currentUser, userRole } = useAuth();
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fica "escutando" o banco de dados em tempo real
    const q = query(collection(db, 'atividades'), orderBy('dataCriacao', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listaAtividades = [];
      snapshot.forEach((doc) => {
        listaAtividades.push({ id: doc.id, ...doc.data() });
      });
      setAtividades(listaAtividades);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-blue-800">Mais Médicos UFPI</h1>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full mt-1 inline-block">
            {userRole === 'admin' ? 'Administrador' : 'Aprovador'}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden md:block">
            {currentUser?.email}
          </span>
          <button onClick={() => logout()} className="flex items-center gap-2 text-red-500 hover:text-red-700 font-medium transition-colors">
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Visão Geral</h2>
          
          <div className="flex items-center gap-3">
            {/* Novo Botão de Alunos (Só aparece para o Admin) */}
            {userRole === 'admin' && (
              <Link to="/alunos" className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                <Users size={20} />
                <span className="hidden md:inline">Alunos</span>
              </Link>
            )}

            <Link to="/nova-atividade" className="flex items-center gap-2 bg-blue-600 text-white px-4 py
            
