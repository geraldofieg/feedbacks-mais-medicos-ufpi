import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  PlusCircle, ClipboardList, Users, Settings, LogOut, 
  CheckCircle, Clock, Calendar, ChevronRight, AlertTriangle, Send, CheckCheck, Sparkles
} from 'lucide-react';

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ revisao: 0, postar: 0, finalizados: 0 });
  const [iaStats, setIaStats] = useState({ total: 0, originais: 0, taxa: 0 });
  const [ultimaData, setUltimaData] = useState(null);

  // A linha blindada com o seu e-mail
  const isAdmin = currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com'; 

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'atividades'), (snap) => {
      const docs = snap.docs.map(doc => doc.data());
      
      const aprovados = docs.filter(d => d.status === 'aprovado');
      setStats({
        revisao: docs.filter(d => d.status === 'pendente').length,
        postar: aprovados.filter(d => !d.postado).length,
        finalizados: aprovados.filter(d => d.postado === true).length
      });

      const originais = aprovados.filter(d => d.feedbackFinal?.trim() === d.feedbackSugerido?.trim()).length;
      const taxa = aprovados.length > 0 ? Math.round((originais / aprovados.length) * 100) : 0;
      setIaStats({ total: aprovados.length, originais, taxa });
    });

    const qUltima = query(collection(db, 'atividades'), orderBy('dataCriacao', 'desc'), limit(1));
    const unsubUltima = onSnapshot(qUltima, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data().dataCriacao?.toDate();
        if (data) setUltimaData(data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
      }
    });

    return () => { unsub(); unsubUltima(); };
  }, []);

  async function handleLogout() { try { await logout(); navigate('/login'); } catch (e) { console.error(e); } }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:
