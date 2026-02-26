import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCircle, FileText, ExternalLink, User, Copy, Trash2, CheckCheck, Send, RotateCcw, Sparkles, Edit3, CalendarDays } from 'lucide-react';

export default function RevisarAtividade() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [atividade, setAtividade] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [feedbackEditado, setFeedbackEditado] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [marcandoPostado, setMarcandoPostado] = useState(false);

  // === CRACHÁ DE IDENTIFICAÇÃO ===
  const isAdmin = currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com'; 

  useEffect(() => {
    async function buscarAtividade() {
      try {
        const docRef = doc(db, 'atividades', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const dados = docSnap.data();
          setAtividade({ id: docSnap.id, ...dados });
          setFeedbackEditado(dados.feedbackSugerido || '');
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }
    buscarAtividade();
  }, [id]);

  // NOVO: Navegação inteligente após Aprovar
  async function handleAprovar() {
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'atividades', id), {
        feedbackFinal: feedbackEditado,
        status: 'aprovado',
        postado: false,
        dataAprovacao: new Date()
      });
      
      // Busca a próxima pendência da professora
      const q = query(collection(db, 'atividades'), where('status', '==', 'pendente'));
      const snap = await getDocs(q);
      const nextDoc = snap.docs.find(d => d.id !== id);
      
      if (nextDoc) navigate('/revisar/' + nextDoc.id); // Pula pro próximo
      else navigate('/'); // Volta pro menu inicial se acabou
      
    } catch (error) { alert("Erro ao salvar."); setSalvando(false); }
  }

  async function handleExcluir() {
    if (window.confirm("Atenção: Tem certeza
